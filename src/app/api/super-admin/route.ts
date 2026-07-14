import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const { count: totalOrgs } = await auth.db
    .from('organisations')
    .select('*', { count: 'exact', head: true })

  const { count: activeOrgs } = await auth.db
    .from('organisations')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: trialOrgs } = await auth.db
    .from('organisations')
    .select('*', { count: 'exact', head: true })
    .eq('plan', 'trial')

  const { count: totalUsers } = await auth.db
    .from('users')
    .select('*', { count: 'exact', head: true })

  const { count: totalProducts } = await auth.db
    .from('products')
    .select('*', { count: 'exact', head: true })

  const { count: totalSales } = await auth.db
    .from('sales')
    .select('*', { count: 'exact', head: true })

  // Recent orgs
  const { data: recentOrgs } = await auth.db
    .from('organisations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    summary: {
      totalOrganisations: totalOrgs || 0,
      activeSubscriptions: activeOrgs || 0,
      trialAccounts: trialOrgs || 0,
      totalUsers: totalUsers || 0,
      totalProducts: totalProducts || 0,
      totalSales: totalSales || 0,
    },
    organisations: recentOrgs || [],
  })
}