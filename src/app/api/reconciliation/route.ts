import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { auditLog, todayStr } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const date = searchParams.get('date') || todayStr()
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  // Find existing or create auto
  let recon = await db.reconciliation.findUnique({ where: { date_storeId: { date, storeId } }, include: { items: { include: { product: { select: { name: true } } } } } })

  if (!recon) {
    // Auto-build from inventory + today's sales
    const products = await db.product.findMany({ where: { organisationId: auth.orgId, storeId } })
    const todayStart = new Date(date + 'T00:00:00')
    const todayEnd = new Date(date + 'T23:59:59')

    const salesItems = await db.saleItem.findMany({
      where: { sale: { storeId, createdAt: { gte: todayStart, lte: todayEnd } } }
    })
    const salesByProduct: Record<string, number> = {}
    for (const si of salesItems) {
      salesByProduct[si.productId] = (salesByProduct[si.productId] || 0) + si.qty
    }

    recon = await db.reconciliation.create({
      data: {
        date, storeId, organisationId: auth.orgId, recordedBy: auth.userId,
        items: { create: products.map(p => ({
          productId: p.id, opening: p.openingStock,
          salesToday: salesByProduct[p.id] || 0,
          stockAdded: 0, expectedClosing: p.openingStock - (salesByProduct[p.id] || 0)
        })) }
      },
      include: { items: { include: { product: { select: { name: true } } } } }
    })
  }

  return NextResponse.json(recon)
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { id, items } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const recon = await db.reconciliation.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!recon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  for (const item of items) {
    const ri = await db.reconItem.findFirst({ where: { id: item.id, reconciliationId: id } })
    if (ri) {
      await db.reconItem.update({
        where: { id: item.id },
        data: { stockAdded: item.stockAdded || 0, actualClosing: item.actualClosing ?? null }
      })
    }
  }

  await auditLog({ action: 'reconciliation.updated', entity: 'Reconciliation', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}