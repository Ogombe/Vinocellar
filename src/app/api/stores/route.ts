import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const stores = await db.store.findMany({
    where: { organisationId: auth.orgId },
    include: {
      _count: { select: { products: true, sales: true } },
      products: { select: { currentStock: true, costPrice: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  const enriched = stores.map(s => ({
    ...s,
    totalProducts: s._count.products,
    totalSales: s._count.sales,
    stockValue: s.products.reduce((sum: number, p: any) => sum + (p.currentStock * p.costPrice), 0),
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { name, location } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const store = await db.store.create({
    data: { name, location: location || '', organisationId: auth.orgId }
  })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'store.created', entity: 'Store', entityId: store.id, afterValue: { name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(store, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const store = await db.store.update({ where: { id }, data })
  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'store.updated', entity: 'Store', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(store)
}