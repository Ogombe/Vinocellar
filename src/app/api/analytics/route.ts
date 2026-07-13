import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { daysAgo } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const period = searchParams.get('period') || '30'
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const days = parseInt(period)
  const startDate = daysAgo(days)

  // Sales trend
  const sales = await db.sale.findMany({
    where: { organisationId: auth.orgId, storeId, createdAt: { gte: startDate } },
    include: { items: true }
  })

  // Daily revenue trend
  const dailyRevenue: Record<string, number> = {}
  for (const sale of sales) {
    const ds = sale.createdAt.toISOString().split('T')[0]
    dailyRevenue[ds] = (dailyRevenue[ds] || 0) + sale.total
  }
  const trendData = Object.entries(dailyRevenue).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date))

  // Category breakdown
  const allItems = sales.flatMap(s => s.items)
  const catRevenue: Record<string, number> = {}
  for (const item of allItems) {
    const prod = await db.product.findUnique({ where: { id: item.productId }, select: { category: true } })
    const cat = prod?.category || 'Other'
    catRevenue[cat] = (catRevenue[cat] || 0) + (item.price * item.qty)
  }
  const categoryData = Object.entries(catRevenue).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue)

  // Top 10 products
  const prodRevenue: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const item of allItems) {
    if (!prodRevenue[item.productId]) prodRevenue[item.productId] = { name: item.name, revenue: 0, qty: 0 }
    prodRevenue[item.productId].revenue += item.price * item.qty
    prodRevenue[item.productId].qty += item.qty
  }
  const topProducts = Object.values(prodRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Payment methods
  const paymentData: Record<string, number> = {}
  for (const sale of sales) {
    paymentData[sale.paymentMethod] = (paymentData[sale.paymentMethod] || 0) + sale.total
  }
  const paymentBreakdown = Object.entries(paymentData).map(([method, total]) => ({ method, total }))

  // Profit data
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
  const totalCost = allItems.reduce((s, item) => s + (item.cost * item.qty), 0)
  const grossProfit = totalRevenue - totalCost
  const expenses = await db.expense.findMany({ where: { organisationId: auth.orgId, storeId, date: { gte: startDate.toISOString().split('T')[0] } } })
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = grossProfit - totalExpenses

  // Expense by category
  const expByCategory: Record<string, number> = {}
  for (const e of expenses) { expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount }
  const expenseBreakdown = Object.entries(expByCategory).map(([category, amount]) => ({ category, amount }))

  // Daily profit trend
  const dailyProfit: Record<string, { revenue: number; cost: number; profit: number }> = {}
  for (const sale of sales) {
    const ds = sale.createdAt.toISOString().split('T')[0]
    if (!dailyProfit[ds]) dailyProfit[ds] = { revenue: 0, cost: 0, profit: 0 }
    dailyProfit[ds].revenue += sale.total
    for (const item of sale.items) dailyProfit[ds].cost += item.cost * item.qty
    dailyProfit[ds].profit = dailyProfit[ds].revenue - dailyProfit[ds].cost
  }
  const profitTrend = Object.entries(dailyProfit).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date))

  // Per-product P&L
  const productPL: Record<string, { name: string; revenue: number; cost: number; profit: number; margin: number }> = {}
  for (const item of allItems) {
    if (!productPL[item.productId]) productPL[item.productId] = { name: item.name, revenue: 0, cost: 0, profit: 0, margin: 0 }
    const rev = item.price * item.qty
    const cost = item.cost * item.qty
    productPL[item.productId].revenue += rev
    productPL[item.productId].cost += cost
    productPL[item.productId].profit += rev - cost
  }
  for (const p of Object.values(productPL)) { p.margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0 }
  const productPLList = Object.values(productPL).sort((a, b) => b.profit - a.profit)

  return NextResponse.json({
    totalRevenue, totalCost, grossProfit, totalExpenses, netProfit,
    grossMargin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
    netMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
    salesCount: sales.length,
    trendData, categoryData, topProducts, paymentBreakdown, expenseBreakdown, profitTrend, productPLList
  })
}