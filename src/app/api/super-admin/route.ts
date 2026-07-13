import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  // Only super_admin can access
  if (auth.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const totalOrgs = await db.organisation.count()
  const activeOrgs = await db.organisation.count({ where: { isActive: true } })
  const trialOrgs = await db.organisation.count({ where: { plan: 'trial' } })
  const totalUsers = await db.user.count()
  const totalProducts = await db.product.count()
  const totalSales = await db.sale.count()

  // Recent orgs
  const recentOrgs = await db.organisation.findMany({
    select: { id: true, name: true, plan: true, isActive: true, createdAt: true, _count: { select: { users: true, products: true } } },
    orderBy: { createdAt: 'desc' }, take: 20
  })

  return NextResponse.json({ totalOrgs, activeOrgs, trialOrgs, totalUsers, totalProducts, totalSales, recentOrgs })
}