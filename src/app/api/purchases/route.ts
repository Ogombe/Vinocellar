import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

// GET: List recent stock receives
export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  // Get recent audit logs for stock receives
  const logs = await db.auditLog.findMany({
    where: { organisationId: auth.orgId, action: 'product.stock_received' },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return NextResponse.json(logs)
}

// POST: Receive stock (add to current stock)
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { items, storeId } = body
  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

  const results = []

  for (const item of items) {
    const { productId, qty, costPrice } = item
    if (!productId || !qty || qty <= 0) continue

    const product = await db.product.findFirst({
      where: { id: productId, organisationId: auth.orgId, storeId: sid }
    })
    if (!product) continue

    const updateData: any = { currentStock: { increment: qty } }
    if (costPrice && costPrice > 0) updateData.costPrice = costPrice

    const updated = await db.product.update({
      where: { id: productId },
      data: updateData
    })

    await auditLog({
      action: 'product.stock_received',
      entity: 'Product',
      entityId: productId,
      beforeValue: { currentStock: product.currentStock, costPrice: product.costPrice },
      afterValue: { currentStock: updated.currentStock, costPrice: costPrice || product.costPrice, qtyAdded: qty },
      userId: auth.userId,
      organisationId: auth.orgId
    })

    results.push({ productId, name: product.name, previousStock: product.currentStock, newStock: updated.currentStock, qtyAdded: qty })
  }

  return NextResponse.json({ received: results.length, items: results }, { status: 201 })
}