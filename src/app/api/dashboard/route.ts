import { NextRequest, NextResponse } from 'next/server'
import { withAuth, checkSubscription, subscriptionErrorResponse } from '@/lib/middleware'
import { todayStr, daysAgo, startOfWeek, startOfMonth, calculateHealthScore } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const today = todayStr()
  const weekStart = startOfWeek().toISOString()
  const monthStart = startOfMonth().toISOString()
  const thirtyDaysAgo = daysAgo(30).toISOString()

  // ── Products ──
  const { data: products } = await auth.db
    .from('products')
    .select('id, name, current_stock, reorder_level, cost_price, sell_price')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)

  const allProducts = products || []
  const totalProducts = allProducts.length
  const lowStockItems = allProducts.filter(p => p.current_stock > 0 && p.current_stock <= p.reorder_level)
  const outOfStockItems = allProducts.filter(p => p.current_stock === 0)
  const lowStock = lowStockItems.length
  const outOfStock = outOfStockItems.length
  const inventoryValue = allProducts.reduce((s, p) => s + p.current_stock * p.cost_price, 0)
  const healthScore = calculateHealthScore(allProducts)

  // ── Sales (today) ──
  const { data: todaySales } = await auth.db
    .from('sales')
    .select('id, total')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('created_at', today + 'T00:00:00')

  const todayRevenue = (todaySales || []).reduce((s, sale) => s + Number(sale.total), 0)

  // ── Sales (yesterday for comparison) ──
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: yesterdaySales } = await auth.db
    .from('sales')
    .select('id, total')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('created_at', yesterdayStr + 'T00:00:00')
    .lt('created_at', today + 'T00:00:00')

  const yesterdayRevenue = (yesterdaySales || []).reduce((s, sale) => s + Number(sale.total), 0)

  // ── Sales (this week) ──
  const { data: weekSales } = await auth.db
    .from('sales')
    .select('id, total')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('created_at', weekStart)

  const weekRevenue = (weekSales || []).reduce((s, sale) => s + Number(sale.total), 0)

  // ── Sales (this month) ──
  const { data: monthSales } = await auth.db
    .from('sales')
    .select('id, total')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .gte('created_at', monthStart)

  const monthRevenue = (monthSales || []).reduce((s, sale) => s + Number(sale.total), 0)

  // ── Weekly revenue chart (last 7 days) ──
  const weeklyData: Array<{ date: string; day: string; revenue: number; count: number }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const daySales = await auth.db
      .from('sales')
      .select('id, total')
      .eq('organisation_id', auth.orgId)
      .eq('store_id', storeId)
      .gte('created_at', ds + 'T00:00:00')
      .lte('created_at', ds + 'T23:59:59')

    weeklyData.push({
      date: ds,
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      revenue: (daySales.data || []).reduce((s, sale) => s + Number(sale.total), 0),
      count: (daySales.data || []).length
    })
  }

  // ── Top sellers this week (via sale_items) ──
  const { data: weekSaleItems } = await auth.db
    .from('sale_items')
    .select('name, qty, price, product_id, sale:sales!sale_id(created_at, store_id, organisation_id)')
    .gte('created_at', weekStart)

  const productRevenue: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const si of (weekSaleItems || [])) {
    const sale = (si as any).sale
    if (!sale || sale.store_id !== storeId || sale.organisation_id !== auth.orgId) continue
    const pid = (si as any).product_id
    if (!productRevenue[pid]) productRevenue[pid] = { name: si.name, revenue: 0, qty: 0 }
    productRevenue[pid].revenue += Number(si.price) * si.qty
    productRevenue[pid].qty += si.qty
  }
  const topSellers = Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // ── Fast movers / slow movers (last 30 days) ──
  const { data: allSaleItems } = await auth.db
    .from('sale_items')
    .select('name, qty, price, product_id, sale:sales!sale_id(created_at, store_id, organisation_id)')
    .gte('created_at', thirtyDaysAgo)

  const salesByProduct: Record<string, { name: string; qty: number; revenue: number }> = {}
  for (const si of (allSaleItems || [])) {
    const sale = (si as any).sale
    if (!sale || sale.store_id !== storeId || sale.organisation_id !== auth.orgId) continue
    const pid = (si as any).product_id
    if (!salesByProduct[pid]) salesByProduct[pid] = { name: si.name, qty: 0, revenue: 0 }
    salesByProduct[pid].qty += si.qty
    salesByProduct[pid].revenue += Number(si.price) * si.qty
  }

  const fastMovers = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5).map(p => ({
    name: p.name, unitsSold: p.qty, revenue: p.revenue
  }))
  const slowMovers = allProducts
    .filter(p => p.current_stock > 0 && (!salesByProduct[p.id] || salesByProduct[p.id].qty <= 2))
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      unitsSold: salesByProduct[p.id]?.qty || 0,
      revenue: salesByProduct[p.id]?.revenue || 0
    }))

  // ── Recent activity (audit logs) ──
  const { data: recentLogs } = await auth.db
    .from('audit_logs')
    .select('action, created_at, user:users(name)')
    .eq('organisation_id', auth.orgId)
    .order('created_at', { ascending: false })
    .limit(20)

  const recentActivity = (recentLogs || []).map((l: any) => ({
    user: l.user?.name || 'System',
    action: (l.action || '').replace(/_/g, ' ').replace(/\./g, ' '),
    time: l.created_at
  }))

  // ── Low/out of stock lists ──
  const lowStockProducts = lowStockItems.slice(0, 10).map(p => ({ name: p.name, stock: p.current_stock }))
  const outOfStockProducts = outOfStockItems.slice(0, 10).map(p => ({ name: p.name }))

  // ── Highest margin product ──
  const productMargins = allProducts.map(p => {
    const margin = p.sell_price > 0 ? Math.round(((p.sell_price - p.cost_price) / p.sell_price) * 100) : 0
    return { name: p.name, margin, revenue: salesByProduct[p.id]?.revenue || 0 }
  }).filter(p => p.revenue > 0).sort((a, b) => b.margin - a.margin)
  const highestMarginProduct = productMargins.length > 0 ? productMargins[0] : null

  // ── Dead stock ──
  const deadStock = allProducts
    .filter(p => p.current_stock > 0 && !salesByProduct[p.id])
    .slice(0, 5)
    .map(p => ({ name: p.name, daysSinceSale: 30 }))

  // ── Pending stock takes ──
  const { count: pendingStockTakes } = await auth.db
    .from('stock_takes')
    .select('*', { count: 'exact', head: true })
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)
    .eq('status', 'pending')

  return NextResponse.json({
    todaySales: todayRevenue,
    todaySalesCount: (todaySales || []).length,
    weeklySales: weekRevenue,
    monthlySales: monthRevenue,
    inventoryValue,
    totalProducts,
    lowStock,
    outOfStock,
    healthScore,
    weeklyRevenueTrend: weeklyData,
    topSellers,
    fastMovers,
    slowMovers,
    recentActivity,
    lowStockProducts,
    outOfStockProducts,
    highestMarginProduct,
    deadStock,
    yesterdayRevenue,
    pendingStockTakes: pendingStockTakes || 0
  })
}