import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const stockTakes = await db.stockTake.findMany({
    where: { organisationId: auth.orgId, storeId },
    include: { items: { include: { product: { select: { name: true, barcode: true } } } }, starter: { select: { name: true } }, approver: { select: { name: true } } },
    orderBy: { startedAt: 'desc' }
  })

  return NextResponse.json(stockTakes)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { storeId } = await request.json()
  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const products = await db.product.findMany({
    where: { organisationId: auth.orgId, storeId: sid },
    select: { id: true, currentStock: true }
  })

  const stockTake = await db.stockTake.create({
    data: {
      organisationId: auth.orgId, storeId: sid, startedBy: auth.userId,
      items: { create: products.map(p => ({ productId: p.id, expected: p.currentStock, counted: null })) }
    },
    include: { items: { include: { product: { select: { name: true } } } } }
  })

  await auditLog({ action: 'stocktake.started', entity: 'StockTake', entityId: stockTake.id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(stockTake, { status: 201 })
}

// Submit count
export async function PUT(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const body = await request.json()
  const { stockTakeId, items, action } = body

  if (action === 'submit') {
    // Update counted quantities and set status to pending
    for (const item of items) {
      await db.stockTakeItem.update({
        where: { id: item.id },
        data: { counted: item.counted }
      })
    }
    const st = await db.stockTake.update({
      where: { id: stockTakeId }, data: { status: 'pending', submittedAt: new Date() }
    })
    await auditLog({ action: 'stocktake.submitted', entity: 'StockTake', entityId: stockTakeId, userId: auth.userId, organisationId: auth.orgId })
    return NextResponse.json(st)
  }

  if (action === 'approve') {
    if (auth.role !== 'manager') return NextResponse.json({ error: 'Manager required' }, { status: 403 })

    const stItems = await db.stockTakeItem.findMany({ where: { stockTakeId } })

    await db.$transaction(async (tx) => {
      for (const item of stItems) {
        if (item.counted !== null && item.counted !== undefined) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: item.counted, openingStock: item.counted }
          })
        }
      }
      await tx.stockTake.update({
        where: { id: stockTakeId }, data: { status: 'approved', approvedBy: auth.userId, approvedAt: new Date() }
      })
    })

    await auditLog({ action: 'stocktake.approved', entity: 'StockTake', entityId: stockTakeId, userId: auth.userId, organisationId: auth.orgId })
    return NextResponse.json({ success: true })
  }

  if (action === 'update-counts') {
    for (const item of items) {
      await db.stockTakeItem.update({ where: { id: item.id }, data: { counted: item.counted } })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}