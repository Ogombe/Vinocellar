import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { getPlanLimitFields } from '@/lib/plan-limits'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  // ── Dashboard summary ──
  if (action === 'summary') {
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

    const { count: totalStores } = await auth.db
      .from('stores')
      .select('*', { count: 'exact', head: true })

    // Platform revenue this month
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data: monthlySales } = await auth.db
      .from('sales')
      .select('total')
      .gte('created_at', firstOfMonth)

    const monthlyRevenue = monthlySales?.reduce((sum: number, s: { total: number }) => sum + (s.total || 0), 0) || 0

    return NextResponse.json({
      summary: {
        totalOrganisations: totalOrgs || 0,
        activeSubscriptions: activeOrgs || 0,
        trialAccounts: trialOrgs || 0,
        totalUsers: totalUsers || 0,
        totalProducts: totalProducts || 0,
        totalSales: totalSales || 0,
        totalStores: totalStores || 0,
        monthlyRevenue,
      }
    })
  }

  // ── List all organisations ──
  if (action === 'organisations') {
    const { data: orgs } = await auth.db
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: false })

    // Enrich each org with user count, product count, and latest sale
    const enriched = await Promise.all((orgs || []).map(async (org) => {
      const { count: userCount } = await auth.db
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', org.id)

      const { count: productCount } = await auth.db
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', org.id)

      const { count: storeCount } = await auth.db
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', org.id)

      const { count: saleCount } = await auth.db
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('organisation_id', org.id)

      // Get the manager for this org
      const { data: manager } = await auth.db
        .from('users')
        .select('id, name, email, last_login_at, is_active')
        .eq('organisation_id', org.id)
        .eq('role', 'manager')
        .limit(1)
        .single()

      // Get latest sale date
      const { data: latestSale } = await auth.db
        .from('sales')
        .select('created_at')
        .eq('organisation_id', org.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return {
        ...org,
        userCount: userCount || 0,
        productCount: productCount || 0,
        storeCount: storeCount || 0,
        saleCount: saleCount || 0,
        manager,
        latestSale: latestSale?.created_at || null,
      }
    }))

    return NextResponse.json({ organisations: enriched })
  }

  // ── Single organisation detail ──
  if (action === 'org-detail') {
    const orgId = url.searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const { data: org } = await auth.db
      .from('organisations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    const { data: users } = await auth.db
      .from('users')
      .select('id, name, email, role, is_active, last_login_at, store_id, created_at')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })

    const { data: stores } = await auth.db
      .from('stores')
      .select('*')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })

    const { count: productCount } = await auth.db
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', orgId)

    const { count: saleCount } = await auth.db
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', orgId)

    const { count: expenseCount } = await auth.db
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('organisation_id', orgId)

    // Recent sales for this org
    const { data: recentSales } = await auth.db
      .from('sales')
      .select('id, total, payment_method, created_at, staff:sales_staff_id_fkey(name)')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Total revenue
    const { data: allSales } = await auth.db
      .from('sales')
      .select('total')
      .eq('organisation_id', orgId)

    const totalRevenue = allSales?.reduce((sum: number, s: { total: number }) => sum + (s.total || 0), 0) || 0

    return NextResponse.json({
      org,
      users: users || [],
      stores: stores || [],
      productCount: productCount || 0,
      saleCount: saleCount || 0,
      expenseCount: expenseCount || 0,
      recentSales: recentSales || [],
      totalRevenue,
    })
  }

  // ── Activity feed ──
  if (action === 'activity') {
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const { data: logs } = await auth.db
      .from('audit_logs')
      .select('id, action, entity, details, created_at, user:users(name, email)')
      .order('created_at', { ascending: false })
      .limit(limit)

    return NextResponse.json({ logs: logs || [] })
  }

  // ── Default: legacy summary ──
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

// ── POST: Super admin actions ──
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super admin only' }, { status: 403 })
  }

  const body = await request.json()
  const { action } = body

  // ── Suspend / Activate organisation ──
  if (action === 'toggle-org') {
    const { orgId, is_active } = body
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const { error } = await auth.db
      .from('organisations')
      .update({ is_active })
      .eq('id', orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also deactivate all users in the org
    await auth.db
      .from('users')
      .update({ is_active })
      .eq('organisation_id', orgId)

    return NextResponse.json({ success: true, is_active })
  }

  // ── Change plan ──
  if (action === 'change-plan') {
    const { orgId, plan } = body
    if (!orgId || !plan) return NextResponse.json({ error: 'orgId and plan required' }, { status: 400 })

    const validPlans = ['trial', 'starter', 'professional', 'enterprise']
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const limits = getPlanLimitFields(plan)
    const { error } = await auth.db
      .from('organisations')
      .update({ plan, ...limits })
      .eq('id', orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, plan })
  }

  // ── Update org limits ──
  if (action === 'update-limits') {
    const { orgId, max_stores, max_staff, max_products } = body
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const updates: Record<string, number> = {}
    if (max_stores !== undefined) updates.max_stores = max_stores
    if (max_staff !== undefined) updates.max_staff = max_staff
    if (max_products !== undefined) updates.max_products = max_products

    const { error } = await auth.db
      .from('organisations')
      .update(updates)
      .eq('id', orgId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── Suspend / Activate a user ──
  if (action === 'toggle-user') {
    const { userId, is_active } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { error } = await auth.db
      .from('users')
      .update({ is_active })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, is_active })
  }

  // ── Delete organisation (DANGEROUS) ──
  if (action === 'delete-org') {
    const { orgId } = body
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    // Delete all related data (cascade)
    await auth.db.from('audit_logs').delete().eq('organisation_id', orgId)
    await auth.db.from('sale_items').delete().in('sale_id',
      (await auth.db.from('sales').select('id').eq('organisation_id', orgId)).data?.map((s: { id: string }) => s.id) || []
    )
    await auth.db.from('sales').delete().eq('organisation_id', orgId)
    await auth.db.from('stock_movements').delete().eq('organisation_id', orgId)
    await auth.db.from('expenses').delete().eq('organisation_id', orgId)
    await auth.db.from('reconciliations').delete().eq('organisation_id', orgId)
    await auth.db.from('products').delete().eq('organisation_id', orgId)
    await auth.db.from('users').delete().eq('organisation_id', orgId)
    await auth.db.from('stores').delete().eq('organisation_id', orgId)
    await auth.db.from('categories').delete().eq('organisation_id', orgId)
    await auth.db.from('suppliers').delete().eq('organisation_id', orgId)
    await auth.db.from('organisations').delete().eq('id', orgId)

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}