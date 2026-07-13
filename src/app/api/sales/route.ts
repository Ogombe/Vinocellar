import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth, logAndRespond } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const where: any = { organisationId: auth.orgId, storeId }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to + 'T23:59:59')
  }

  const sales = await db.sale.findMany({
    where, include: { items: true, staff: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }, take: limit
  })

  return NextResponse.json(sales)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { items, paymentMethod, storeId } = body
  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

  const total = items.reduce((s: number, i: any) => s + (i.price * i.qty), 0)

  // Deduct stock
  for (const item of items) {
    const product = await db.product.findFirst({ where: { id: item.productId, organisationId: auth.orgId, storeId: sid } })
    if (!product) return NextResponse.json({ error: `Product ${item.name} not found` }, { status: 400 })
    if (product.currentStock < item.qty) return NextResponse.json({ error: `Insufficient stock for ${item.name}` }, { status: 400 })
  }

  // Use transaction for atomic stock deduction
  const sale = await db.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        total, paymentMethod: paymentMethod || 'cash',
        organisationId: auth.orgId, storeId: sid, staffId: auth.userId,
        items: { create: items.map((i: any) => ({ name: i.name, qty: i.qty, price: i.price, cost: i.cost, productId: i.productId })) }
      },
      include: { items: true, staff: { select: { name: true } } }
    })

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.qty } }
      })
    }

    return newSale
  })

  await auditLog({ action: 'sale.created', entity: 'Sale', entityId: sale.id, afterValue: { total, items: sale.items.length, paymentMethod }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(sale, { status: 201 })
}