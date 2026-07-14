import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog, todayStr } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const date = searchParams.get('date') || todayStr()
  if (!storeId) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  // Check if a persisted reconciliation exists
  const { data: existing } = await auth.db
    .from('reconciliations')
    .select('*, reconciliation_items(*, product:products(name, sku))')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .eq('date', date)
    .single()

  if (existing) return NextResponse.json(existing)

  // Auto-build draft from products + today's sales
  const { data: products } = await auth.db
    .from('products')
    .select('id, name, sku, opening_stock, current_stock, cost_price, sell_price')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)

  // Get today's sales items for this store
  const startOfDay = date + 'T00:00:00'
  const endOfDay = date + 'T23:59:59'

  const { data: saleItems } = await auth.db
    .from('sale_items')
    .select('product_id, qty, sale:sales!sale_id(store_id, created_at)')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  const salesByProduct: Record<string, number> = {}
  for (const si of (saleItems || [])) {
    const sale = (si as any).sale
    if (sale?.store_id === storeId) {
      salesByProduct[si.product_id] = (salesByProduct[si.product_id] || 0) + si.qty
    }
  }

  // Get today's purchases/stock additions for this store
  const { data: purchases } = await auth.db
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('store_id', storeId)
    .eq('movement_type', 'purchase')
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)

  const additionsByProduct: Record<string, number> = {}
  for (const m of (purchases || [])) {
    additionsByProduct[m.product_id] = (additionsByProduct[m.product_id] || 0) + m.quantity
  }

  const items = (products || []).map(p => {
    const sold = salesByProduct[p.id] || 0
    const added = additionsByProduct[p.id] || 0
    const expected = p.opening_stock + added - sold
    const variance = null // No actual count yet
    return {
      product_id: p.id,
      product: { name: p.name, sku: p.sku || '' },
      opening_stock: p.opening_stock,
      sales_today: sold,
      stock_added: added,
      expected_closing: Math.max(0, expected),
      actual_closing: null,
      variance: null,
      value_lost: null,
    }
  })

  return NextResponse.json({
    date,
    store_id: storeId,
    items,
    status: 'draft',
    total_products: items.length,
    total_variance: null,
  })
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { date, storeId, items, notes } = body

  if (!date || !items || !items.length) {
    return NextResponse.json({ error: 'Date and items are required' }, { status: 400 })
  }

  const targetStoreId = storeId || auth.storeId
  if (!targetStoreId) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  // Calculate totals
  let totalVariance = 0
  let totalValueLost = 0
  const enrichedItems = items.map((item: any) => {
    const actual = item.actual_closing ?? item.expected_closing
    const variance = (item.expected_closing ?? 0) - (item.actual_closing ?? item.expected_closing ?? 0)
    // Use a default cost price if not available
    const costPrice = item.cost_price || 0
    const valueLost = variance > 0 ? variance * costPrice : 0
    totalVariance += variance
    totalValueLost += valueLost
    return {
      ...item,
      variance,
      value_lost: valueLost,
    }
  })

  // Insert reconciliation header
  const { data: recon, error: reconErr } = await auth.db
    .from('reconciliations')
    .insert({
      date,
      store_id: targetStoreId,
      organisation_id: auth.orgId,
      status: 'completed',
      total_products: enrichedItems.length,
      total_variance: totalVariance,
      notes: notes || null,
      reconciled_by: auth.userId,
    })
    .select()
    .single()

  if (reconErr || !recon) {
    return NextResponse.json({ error: reconErr?.message || 'Failed to save reconciliation' }, { status: 500 })
  }

  // Insert reconciliation items
  const reconItems = enrichedItems.map((item: any) => ({
    reconciliation_id: recon.id,
    product_id: item.product_id,
    opening_stock: item.opening_stock || 0,
    sales_today: item.sales_today || 0,
    stock_added: item.stock_added || 0,
    expected_closing: item.expected_closing || 0,
    actual_closing: item.actual_closing,
    variance: item.variance || 0,
    value_lost: item.value_lost || 0,
  }))

  const { error: itemsErr } = await auth.db
    .from('reconciliation_items')
    .insert(reconItems)

  if (itemsErr) {
    console.error('Reconciliation items insert failed:', itemsErr.message)
    // Header was saved but items failed — still return success with warning
  }

  await auditLog({
    action: 'reconciliation.created',
    entity: 'Reconciliation',
    entityId: recon.id,
    afterValue: { date, totalProducts: enrichedItems.length, totalVariance, totalValueLost },
    userId: auth.userId,
    organisationId: auth.orgId,
  })

  return NextResponse.json({
    id: recon.id,
    date,
    store_id: targetStoreId,
    status: 'completed',
    total_products: enrichedItems.length,
    total_variance: totalVariance,
    total_value_lost: totalValueLost,
    items: enrichedItems,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { id, status, notes } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const updateData: any = {}
  if (status) updateData.status = status
  if (notes !== undefined) updateData.notes = notes

  const { error } = await auth.db
    .from('reconciliations')
    .update(updateData)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'reconciliation.updated', entity: 'Reconciliation', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Delete items first, then header
  await auth.db.from('reconciliation_items').delete().eq('reconciliation_id', id)
  const { error } = await auth.db.from('reconciliations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'reconciliation.deleted', entity: 'Reconciliation', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}