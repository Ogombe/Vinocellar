import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'
import { daysAgo } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const period = searchParams.get('period') || '30'
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const days = parseInt(period)
  const startDate = daysAgo(days).toISOString()

  // Fetch sales with items
  const { data: sales } = await supabaseServer
    .from('sales')
    .select('*, sale_items(*)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('created_at', startDate)

  // Daily revenue trend
  const dailyRevenue: Record<string, number> = {}
  const allItems: any[] = []

  for (const sale of (sales || [])) {
    const ds = sale.created_at.split('T')[0]
    dailyRevenue[ds] = (dailyRevenue[ds] || 0) + Number(sale.total)
    for (const item of (sale.sale_items || [])) {
      allItems.push(item)
    }
  }

  const trendData = Object.entries(dailyRevenue)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Category breakdown - fetch products to get category info
  const { data: products } = await supabaseServer
    .from('products')
    .select('id, category:categories(name)')
    .eq('organisation_id', auth.orgId)

  const productCategory: Record<string, string> = {}
  for (const p of (products || [])) {
    const cat = p.category as any
    productCategory[p.id] = cat?.name || 'Other'
  }

  const catRevenue: Record<string, number> = {}
  for (const item of allItems) {
    const cat = productCategory[item.product_id] || 'Other'
    catRevenue[cat] = (catRevenue[cat] || 0) + (Number(item.price) * item.qty)
  }
  const categoryData = Object.entries(catRevenue).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue)

  // Top 10 products
  const prodRevenue: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const item of allItems) {
    if (!prodRevenue[item.product_id]) prodRevenue[item.product_id] = { name: item.name, revenue: 0, qty: 0 }
    prodRevenue[item.product_id].revenue += Number(item.price) * item.qty
    prodRevenue[item.product_id].qty += item.qty
  }
  const topProducts = Object.values(prodRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Payment methods
  const paymentData: Record<string, number> = {}
  for (const sale of (sales || [])) {
    paymentData[sale.payment_method] = (paymentData[sale.payment_method] || 0) + Number(sale.total)
  }
  const paymentBreakdown = Object.entries(paymentData).map(([method, total]) => ({ method, total }))

  // Profit data
  const totalRevenue = (sales || []).reduce((s, sale) => s + Number(sale.total), 0)
  const totalCost = allItems.reduce((s, item) => s + (Number(item.cost) * item.qty), 0)
  const grossProfit = totalRevenue - totalCost

  // Expenses
  const { data: expenses } = await supabaseServer
    .from('expenses')
    .select('*')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('date', daysAgo(days).toISOString().split('T')[0])

  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
  const netProfit = grossProfit - totalExpenses

  // Expense breakdown
  const expByCategory: Record<string, number> = {}
  for (const e of (expenses || [])) {
    expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount)
  }
  const expenseBreakdown = Object.entries(expByCategory).map(([category, amount]) => ({ category, amount }))

  // Daily profit trend
  const dailyProfit: Record<string, { revenue: number; cost: number; profit: number }> = {}
  for (const sale of (sales || [])) {
    const ds = sale.created_at.split('T')[0]
    if (!dailyProfit[ds]) dailyProfit[ds] = { revenue: 0, cost: 0, profit: 0 }
    dailyProfit[ds].revenue += Number(sale.total)
    for (const item of (sale.sale_items || [])) {
      dailyProfit[ds].cost += Number(item.cost) * item.qty
    }
    dailyProfit[ds].profit = dailyProfit[ds].revenue - dailyProfit[ds].cost
  }
  const profitTrend = Object.entries(dailyProfit).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date))

  // Per-product P&L
  const productPL: Record<string, { name: string; revenue: number; cost: number; profit: number; margin: number }> = {}
  for (const item of allItems) {
    if (!productPL[item.product_id]) productPL[item.product_id] = { name: item.name, revenue: 0, cost: 0, profit: 0, margin: 0 }
    const rev = Number(item.price) * item.qty
    const cost = Number(item.cost) * item.qty
    productPL[item.product_id].revenue += rev
    productPL[item.product_id].cost += cost
    productPL[item.product_id].profit += rev - cost
  }
  for (const p of Object.values(productPL)) {
    p.margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0
  }
  const productPLList = Object.values(productPL).sort((a, b) => b.profit - a.profit)

  return NextResponse.json({
    totalRevenue, totalCost, grossProfit, totalExpenses, netProfit,
    grossMargin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0,
    netMargin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0,
    salesCount: (sales || []).length,
    trendData, categoryData, topProducts, paymentBreakdown, expenseBreakdown, profitTrend, productPLList
  })
}