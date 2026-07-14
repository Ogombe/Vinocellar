import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'

export async function GET(request: Request) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  // Fetch user profile from public.users table
  const { data: profile } = await auth.db
    .from('users')
    .select('id, email, name, role, pin, store_id, is_active, last_login_at')
    .eq('id', auth.userId)
    .single()

  // Fetch organisation
  const { data: org } = await auth.db
    .from('organisations')
    .select('id, name, slug, plan, is_active, max_stores, max_staff, max_products')
    .eq('id', auth.orgId)
    .single()

  // Fetch all stores for this organisation
  const { data: stores } = await auth.db
    .from('stores')
    .select('id, name, location')
    .eq('organisation_id', auth.orgId)

  return NextResponse.json({
    user: profile || { id: auth.userId, email: auth.email, role: auth.role },
    org: org || { id: auth.orgId },
    storeId: auth.storeId,
    stores: stores || []
  })
}