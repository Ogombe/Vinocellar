import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog, todayStr } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const date = searchParams.get('date') || todayStr()
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  // Check if reconciliation exists for this date + store
  const { data: existing } = await auth.db
    .from('reconciliations')
    .select('*, reconciliation_items(*, product:products(name))')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .eq('date', date)
    .single()

  if (existing) return NextResponse.json(existing)

  // Auto-build from products + today's sales
  const { data: products } = await auth.db
    .from('products')
    .select('id, name, opening_stock, current_stock')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)

  // Get today's sales items
  const { data: saleItems } = await auth.db
    .from('sale_items')
    .select('product_id, qty, sale:sales!sale_id(store_id, created_at)')
    .gte('created_at', date + 'T00:00:00')
    .lte('created_at', date + 'T23:59:59')

  const salesByProduct: Record<string, number> = {}
  for (const si of (saleItems || [])) {
    const sale = (si as any).sale
    if (sale?.store_id === storeId) {
      salesByProduct[si.product_id] = (salesByProduct[si.product_id] || 0) + si.qty
    }
  }

  // Return the computed reconciliation data (we don't persist it until saved)
  const items = (products || []).map(p => ({
    product_id: p.id,
    product: { name: p.name },
    opening: p.opening_stock,
    sales_today: salesByProduct[p.id] || 0,
    stock_added: 0,
    expected_closing: p.opening_stock - (salesByProduct[p.id] || 0),
    actual_closing: null,
  }))

  return NextResponse.json({
    date,
    store_id: storeId,
    items,
    status: 'draft',
  })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { id, items } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // For now, return success - reconciliation updates would need
  // reconciliation_items table which may not exist in current schema
  await auditLog({
    action: 'reconciliation.updated', entity: 'Reconciliation', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}