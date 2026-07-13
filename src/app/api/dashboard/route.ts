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
  const lowStock = products.filter(p => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length
  const outOfStock = products.filter(p => p.currentStock === 0).length
  const inventoryValue = products.reduce((s, p) => s + p.currentStock * p.costPrice, 0)
  const healthScore = calculateHealthScore(products)

  // Sales
  const todaySales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: new Date(today + 'T00:00:00') } } })
  const weekSales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: weekStart } } })
  const monthSales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: monthStart } } })

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.total, 0)
  const weekRevenue = weekSales.reduce((s, sale) => s + sale.total, 0)
  const monthRevenue = monthSales.reduce((s, sale) => s + sale.total, 0)

  // Weekly revenue chart (last 7 days)
  const weeklyData = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const daySales = await db.sale.findMany({ where: { organisationId: auth.orgId, storeId, createdAt: { gte: new Date(ds + 'T00:00:00'), lt: new Date(ds + 'T23:59:59') } } })
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

  // Fast movers
  const allSaleItems = await db.saleItem.findMany({
    where: { sale: { organisationId: auth.orgId, storeId, createdAt: { gte: daysAgo(30) } } }
  })
  const salesByProduct: Record<string, { name: string; qty: number }> = {}
  for (const si of allSaleItems) {
    if (!salesByProduct[si.productId]) salesByProduct[si.productId] = { name: si.name, qty: 0 }
    salesByProduct[si.productId].qty += si.qty
  }
  const fastMovers = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5)
  const slowMovers = products.filter(p => p.currentStock > 0 && (!salesByProduct[p.id] || salesByProduct[p.id].qty <= 2)).slice(0, 5)

  // Recent activity (last 20 audit logs)
  const recentActivity = await db.auditLog.findMany({
    where: { organisationId: auth.orgId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' }, take: 20
  })

  // Pending stock takes
  const pendingStockTakes = await db.stockTake.count({
    where: { organisationId: auth.orgId, storeId, status: 'pending' }
  })

  return NextResponse.json({
    todayRevenue, weekRevenue, monthRevenue,
    todaySalesCount: todaySales.length, weekSalesCount: weekSales.length, monthSalesCount: monthSales.length,
    totalProducts, lowStock, outOfStock, inventoryValue, healthScore,
    weeklyData, topSellers, fastMovers, slowMovers,
    recentActivity, pendingStockTakes
  })
}