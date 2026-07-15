import { NextRequest, NextResponse } from 'next/server'
import { withAuth, checkSubscription, subscriptionErrorResponse } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  let query = auth.db
    .from('sales')
    .select('*, sale_items(*), staff:users!staff_id(name)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (from) {
    query = query.gte('created_at', from + 'T00:00:00')
  }
  if (to) {
    query = query.lte('created_at', to + 'T23:59:59')
  }

  const { data: sales, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map to camelCase for front-end
  const mapped = (sales || []).map((s: any) => ({
    id: s.id,
    total: s.total,
    paymentMethod: s.payment_method,
    organisationId: s.organisation_id,
    storeId: s.store_id,
    staffId: s.staff_id,
    createdAt: s.created_at,
    staff: s.staff ? { name: s.staff.name } : null,
    items: (s.sale_items || []).map((si: any) => ({
      id: si.id,
      name: si.name,
      qty: si.qty,
      price: si.price,
      cost: si.cost,
      saleId: si.sale_id,
      productId: si.product_id,
    })),
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { items, paymentMethod, storeId } = body
  const sid = storeId || auth.storeId

  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

  // Call the complete_sale() RPC function in Supabase
  // This atomically: creates the sale, creates sale items, deducts stock, logs stock movements
  const { data: saleId, error } = await auth.db.rpc('complete_sale', {
    p_store_id: sid,
    p_staff_id: auth.userId,
    p_payment_method: paymentMethod || 'cash',
    p_items: items.map((i: any) => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      cost: i.cost || 0,
    })),
  })

  if (error) {
    // Check if it's a stock issue
    if (error.message?.includes('stock') || error.message?.includes('insufficient')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Sale failed' }, { status: 500 })
  }

  // Fetch the completed sale with items for the response
  const { data: sale } = await auth.db
    .from('sales')
    .select('*, sale_items(*)')
    .eq('id', saleId)
    .single()

  const total = items.reduce((s: number, i: any) => s + (i.price * i.qty), 0)

  await auditLog({
    action: 'sale.created', entity: 'Sale', entityId: saleId,
    afterValue: { total, items: items.length, paymentMethod },
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({
    id: saleId,
    total,
    paymentMethod,
    items: (sale?.sale_items || items).map((si: any) => ({
      id: si.id,
      name: si.name || si.name,
      qty: si.qty,
      price: si.price,
      cost: si.cost || 0,
      productId: si.product_id || si.productId,
    })),
    createdAt: sale?.created_at || new Date().toISOString(),
  }, { status: 201 })
}