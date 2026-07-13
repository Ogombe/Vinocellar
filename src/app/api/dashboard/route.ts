import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { todayStr, daysAgo, startOfWeek, startOfMonth, calculateHealthScore } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 400 })

  const today = todayStr()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth()

  // Products
  const products = await db.product.findMany({ where: { organisationId: auth.orgId, storeId } })
  const totalProducts = products.length
  const lowStockItems = products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderLevel)
  const lowStock = lowStockItems.length
  const outOfStockItems = products.filter(p => p.currentStock === 0)
  const outOfStock = outOfStockItems.length
  const inventoryValue = products.reduce((s, p) => s + p.currentStock * p.costPrice, 0)
  const healthScore = calculateHealthScore(products)

  // Sales
  const todaySales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: new Date(today + 'T00:00:00') } } })
  const weekSales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: weekStart } } })
  const monthSales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: monthStart } } })

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.total, 0)
  const weekRevenue = weekSales.reduce((s, sale) => s + sale.total, 0)
  const monthRevenue = monthSales.reduce((s, sale) => s + sale.total, 0)

  // Yesterday revenue for comparison
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdaySales = await db.sale.findMany({
    where: { organisationId: auth.orgId, storeId, createdAt: { gte: new Date(yesterdayStr + 'T00:00:00'), lt: new Date(today + 'T00:00:00') } }
  })
  const yesterdayRevenue = yesterdaySales.reduce((s, sale) => s + sale.total, 0)

  // Weekly revenue chart (last 7 days)
  const weeklyData = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const dayStart = new Date(ds + 'T00:00:00')
    const dayEnd = new Date(ds + 'T23:59:59')
    const daySales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: dayStart, lte: dayEnd } } })
    weeklyData.push({
      date: ds,
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      revenue: daySales.reduce((s, sale) => s + sale.total, 0),
      count: daySales.length
    })
  }

  // Top sellers this week
  const weekSaleItems = await db.saleItem.findMany({
    where: { sale: { organisationId: auth.orgId, storeId, createdAt: { gte: weekStart } } }
  })
  const productRevenue: Record<string, { name: string; revenue: number; qty: number }> = {}
  for (const si of weekSaleItems) {
    if (!productRevenue[si.productId]) productRevenue[si.productId] = { name: si.name, revenue: 0, qty: 0 }
    productRevenue[si.productId].revenue += si.price * si.qty
    productRevenue[si.productId].qty += si.qty
  }
  const topSellers = Object.values(productRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  // Fast movers (last 30 days)
  const allSaleItems = await db.saleItem.findMany({
    where: { sale: { organisationId: auth.orgId, storeId, createdAt: { gte: daysAgo(30) } } }
  })
  const salesByProduct: Record<string, { name: string; qty: number; revenue: number }> = {}
  for (const si of allSaleItems) {
    if (!salesByProduct[si.productId]) salesByProduct[si.productId] = { name: si.name, qty: 0, revenue: 0 }
    salesByProduct[si.productId].qty += si.qty
    salesByProduct[si.productId].revenue += si.price * si.qty
  }
  const fastMovers = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5).map(p => ({
    name: p.name, unitsSold: p.qty, revenue: p.revenue
  }))
  const slowMovers = products
    .filter(p => p.currentStock > 0 && (!salesByProduct[p.id] || salesByProduct[p.id].qty <= 2))
    .slice(0, 5)
    .map(p => ({
      name: p.name,
      unitsSold: salesByProduct[p.id]?.qty || 0,
      revenue: salesByProduct[p.id]?.revenue || 0
    }))

  // Recent activity (last 20 audit logs)
  const recentActivity = await db.auditLog.findMany({
    where: { organisationId: auth.orgId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }, take: 20
  }).then(logs => logs.map(l => ({
    user: l.user?.name || 'System',
    action: l.action.replace(/_/g, ' ').replace(/\./g, ' '),
    time: l.createdAt.toISOString()
  })))

  // Low stock products list
  const lowStockProducts = lowStockItems.slice(0, 10).map(p => ({ name: p.name, stock: p.currentStock }))
  const outOfStockProducts = outOfStockItems.slice(0, 10).map(p => ({ name: p.name }))

  // Highest margin product
  const productMargins = products.map(p => {
    const margin = p.sellPrice > 0 ? Math.round(((p.sellPrice - p.costPrice) / p.sellPrice) * 100) : 0
    return { name: p.name, margin, revenue: salesByProduct[p.id]?.revenue || 0 }
  }).filter(p => p.revenue > 0).sort((a, b) => b.margin - a.margin)
  const highestMarginProduct = productMargins.length > 0 ? productMargins[0] : null

  // Dead stock (products with stock but no sales in 30 days)
  const deadStock = products
    .filter(p => p.currentStock > 0 && !salesByProduct[p.id])
    .slice(0, 5)
    .map(p => ({ name: p.name, daysSinceSale: 30 }))

  // Pending stock takes
  const pendingStockTakes = await db.stockTake.count({
    where: { organisationId: auth.orgId, storeId, status: 'pending' }
  })

  return NextResponse.json({
    // Match DashboardPage expected field names
    todaySales: todayRevenue,
    todaySalesCount: todaySales.length,
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
    pendingStockTakes
  })
}