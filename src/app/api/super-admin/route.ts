import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const { count: totalOrgs } = await supabaseServer
    .from('organisations')
    .select('*', { count: 'exact', head: true })

  const { count: activeOrgs } = await supabaseServer
    .from('organisations')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  const { count: trialOrgs } = await supabaseServer
    .from('organisations')
    .select('*', { count: 'exact', head: true })
    .eq('plan', 'trial')

  const { count: totalUsers } = await supabaseServer
    .from('users')
    .select('*', { count: 'exact', head: true })

  const { count: totalProducts } = await supabaseServer
    .from('products')
    .select('*', { count: 'exact', head: true })

  const { count: totalSales } = await supabaseServer
    .from('sales')
    .select('*', { count: 'exact', head: true })

  // Recent orgs
  const { data: recentOrgs } = await supabaseServer
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