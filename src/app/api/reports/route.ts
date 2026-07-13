import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { daysAgo, todayStr } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const type = searchParams.get('type') || 'sales'
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const today = todayStr()
  const startDate = daysAgo(30)

  if (type === 'sales') {
    const sales = await db.sale.findMany({
      where: { organisationId: auth.orgId, storeId, createdAt: { gte: startDate } },
      include: { items: true, staff: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const total = sales.reduce((s, sale) => s + sale.total, 0)
    return NextResponse.json({ sales, total, count: sales.length })
  }

  if (type === 'inventory') {
    const products = await db.product.findMany({
      where: { organisationId: auth.orgId, storeId },
      include: { category: true, supplier: true }
    })
    const totalValue = products.reduce((s, p) => s + p.currentStock * p.costPrice, 0)
    return NextResponse.json({ products, totalValue, count: products.length })
  }

  if (type === 'profit-loss') {
    const sales = await db.sale.findMany({
      where: { organisationId: auth.orgId, storeId, createdAt: { gte: startDate } },
      include: { items: true }
    })
    const revenue = sales.reduce((s, sale) => s + sale.total, 0)
    const cogs = sales.flatMap(s => s.items).reduce((s, item) => s + item.cost * item.qty, 0)
    const expenses = await db.expense.findMany({ where: { organisationId: auth.orgId, storeId, date: { gte: startDate.toISOString().split('T')[0] } } })
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    return NextResponse.json({ revenue, cogs, grossProfit: revenue - cogs, expenses, totalExpenses, netProfit: revenue - cogs - totalExpenses, period: 'Last 30 Days' })
  }

  if (type === 'expense') {
    const expenses = await db.expense.findMany({
      where: { organisationId: auth.orgId, storeId, date: { gte: startDate.toISOString().split('T')[0] } },
      orderBy: { date: 'desc' }
    })
    const byCategory: Record<string, number> = {}
    for (const e of expenses) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
    return NextResponse.json({ expenses, byCategory, total: expenses.reduce((s, e) => s + e.amount, 0) })
  }

  if (type === 'reconciliation') {
    const recs = await db.reconciliation.findMany({
      where: { organisationId: auth.orgId, storeId },
      include: { items: { include: { product: { select: { name: true } } } } },
      orderBy: { date: 'desc' }, take: 30
    })
    return NextResponse.json({ reconciliations: recs })
  }

  if (type === 'stock-audit') {
    const stockTakes = await db.stockTake.findMany({
      where: { organisationId: auth.orgId, storeId },
      include: { items: { include: { product: { select: { name: true } } } }, starter: { select: { name: true } }, approver: { select: { name: true } } },
      orderBy: { startedAt: 'desc' }
    })
    return NextResponse.json({ stockTakes })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}