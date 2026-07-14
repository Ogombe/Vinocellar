import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const { data: stockTakes, error } = await auth.db
    .from('stock_takes')
    .select('*, stock_take_items(*, product:products(name, barcode)), starter:users!started_by(name), approver:users!approved_by(name)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (stockTakes || []).map((st: any) => ({
    id: st.id,
    status: st.status,
    storeId: st.store_id,
    organisationId: st.organisation_id,
    startedBy: st.started_by,
    startedAt: st.started_at,
    submittedAt: st.submitted_at,
    approvedBy: st.approved_by,
    approvedAt: st.approved_at,
    starter: st.starter ? { name: st.starter.name } : null,
    approver: st.approver ? { name: st.approver.name } : null,
    items: (st.stock_take_items || []).map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      expected: i.expected,
      counted: i.counted,
      product: i.product ? { name: i.product.name, barcode: i.product.barcode } : null,
    })),
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { storeId } = await request.json()
  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })

  // Get all products for this store
  const { data: products } = await auth.db
    .from('products')
    .select('id, current_stock')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', sid)

  const stockTakeId = uuidv4()

  // Create stock take header
  const { error: stError } = await auth.db
    .from('stock_takes')
    .insert({
      id: stockTakeId,
      organisation_id: auth.orgId,
      store_id: sid,
      started_by: auth.userId,
      status: 'in_progress',
    })

  if (stError) return NextResponse.json({ error: stError.message }, { status: 400 })

  // Create stock take items for each product
  if (products && products.length > 0) {
    const items = products.map((p: any) => ({
      id: uuidv4(),
      stock_take_id: stockTakeId,
      product_id: p.id,
      expected: p.current_stock,
      counted: null,
    }))

    const { error: itemsError } = await auth.db
      .from('stock_take_items')
      .insert(items)

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 400 })
  }

  await auditLog({
    action: 'stocktake.started', entity: 'StockTake', entityId: stockTakeId,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ id: stockTakeId, status: 'in_progress' }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { stockTakeId, items, action } = body

  if (action === 'submit') {
    // Update counted quantities
    if (items) {
      for (const item of items) {
        await auth.db
          .from('stock_take_items')
          .update({ counted: item.counted })
          .eq('id', item.id)
      }
    }

    const { error } = await auth.db
      .from('stock_takes')
      .update({ status: 'pending', submitted_at: new Date().toISOString() })
      .eq('id', stockTakeId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog({
      action: 'stocktake.submitted', entity: 'StockTake', entityId: stockTakeId,
      userId: auth.userId, organisationId: auth.orgId
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'approve') {
    if (auth.role !== 'manager' && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Manager required' }, { status: 403 })
    }

    // Get all items for this stock take
    const { data: stItems } = await auth.db
      .from('stock_take_items')
      .select('*')
      .eq('stock_take_id', stockTakeId)

    // Update product stock to counted values and log adjustments
    for (const item of (stItems || [])) {
      if (item.counted !== null && item.counted !== undefined) {
        // Update product stock
        await auth.db
          .from('products')
          .update({ current_stock: item.counted })
          .eq('id', item.product_id)

        // Log as stock_take movement
        const diff = item.counted - item.expected
        if (diff !== 0) {
          const { data: product } = await auth.db
            .from('products')
            .select('store_id')
            .eq('id', item.product_id)
            .single()

          await auth.db
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              store_id: product?.store_id,
              organisation_id: auth.orgId,
              movement_type: 'stock_take',
              quantity: diff,
              reference_id: stockTakeId,
              notes: 'Stock take adjustment',
              created_by: auth.userId,
            })
        }
      }
    }

    // Mark stock take as approved
    await auth.db
      .from('stock_takes')
      .update({
        status: 'approved',
        approved_by: auth.userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', stockTakeId)

    await auditLog({
      action: 'stocktake.approved', entity: 'StockTake', entityId: stockTakeId,
      userId: auth.userId, organisationId: auth.orgId
    })

    return NextResponse.json({ success: true })
  }

  if (action === 'update-counts') {
    if (items) {
      for (const item of items) {
        await auth.db
          .from('stock_take_items')
          .update({ counted: item.counted })
          .eq('id', item.id)
      }
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}