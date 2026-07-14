import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

// GET: List recent stock receives (use the receive_stock RPC or query purchases)
export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  // Query purchases table for stock receive history
  const { data: purchases, error } = await auth.db
    .from('purchases')
    .select('*, supplier:suppliers(name), purchase_items(*)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also get recent stock movements for this store
  const { data: movements } = await auth.db
    .from('stock_movements')
    .select('*, product:products(name)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .eq('movement_type', 'purchase')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    purchases: purchases || [],
    movements: movements || [],
  })
}

// POST: Receive stock — call the receive_stock RPC function
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { items, storeId, supplierId, notes } = body
  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

  // Call the receive_stock() RPC — this atomically creates the purchase,
  // adds stock to products, and logs stock movements
  const rpcItems = items.map((i: any) => ({
    productId: i.productId,
    qty: i.qty,
    costPrice: i.costPrice || 0,
  }))

  const { data: purchaseId, error } = await auth.db.rpc('receive_stock', {
    p_store_id: sid,
    p_supplier_id: supplierId || null,
    p_items: rpcItems,
    p_received_by: auth.userId,
    p_notes: notes || '',
  })

  if (error) {
    return NextResponse.json({ error: error.message || 'Stock receive failed' }, { status: 500 })
  }

  // Fetch updated product stock for the response
  const results = []
  for (const item of items) {
    const { data: product } = await auth.db
      .from('products')
      .select('name, current_stock')
      .eq('id', item.productId)
      .single()

    results.push({
      productId: item.productId,
      name: product?.name || 'Unknown',
      qtyAdded: item.qty,
      newStock: product?.current_stock || 0,
    })
  }

  await auditLog({
    action: 'stock.received', entity: 'Purchase', entityId: purchaseId,
    afterValue: { items: items.length, supplierId },
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ received: results.length, items: results, purchaseId }, { status: 201 })
}