import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { SupabaseClient } from '@supabase/supabase-js'

export interface AuthResult {
  userId: string
  email: string
  orgId: string
  storeId: string | null
  role: string
  db: SupabaseClient  // Authenticated Supabase client — use this for all queries
  error?: never
}

export interface AuthError {
  error: NextResponse
}

export interface SubscriptionStatus {
  active: boolean
  reason?: 'trial_expired' | 'subscription_expired' | 'suspended'
  plan?: string
  trial_ends_at?: string | null
  current_period_end?: string | null
}

/**
 * Check if an organisation's subscription/trial is active.
 * Call this in API routes after withAuth() to enforce server-side.
 * Returns { active: true } if all good, or { active: false, reason: '...' }.
 */
export async function checkSubscription(
  db: SupabaseClient,
  orgId: string,
  role: string
): Promise<SubscriptionStatus> {
  // Super admins bypass all subscription checks
  if (role === 'super_admin') return { active: true }

  const { data: org, error } = await db
    .from('organisations')
    .select('plan, is_active, trial_ends_at, current_period_end')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    return { active: false, reason: 'suspended' }
  }

  // Check if organisation is suspended
  if (!org.is_active) {
    return { active: false, reason: 'suspended', ...org }
  }

  // Check trial expiry
  if (org.plan === 'trial' && org.trial_ends_at) {
    if (new Date(org.trial_ends_at) < new Date()) {
      return { active: false, reason: 'trial_expired', ...org }
    }
  }

  // Check subscription expiry
  if (org.plan !== 'trial' && org.current_period_end) {
    if (new Date(org.current_period_end) < new Date()) {
      return { active: false, reason: 'subscription_expired', ...org }
    }
  }

  return { active: true, ...org }
}

/**
 * Helper to return a subscription-blocked error response.
 * Use after checkSubscription() returns { active: false }.
 */
export function subscriptionErrorResponse(status: SubscriptionStatus): NextResponse {
  const messages: Record<string, string> = {
    trial_expired: 'Your trial has expired. Please upgrade your plan to continue.',
    subscription_expired: 'Your subscription has expired. Please renew to continue.',
    suspended: 'Your account has been suspended. Please contact support.',
  }
  return NextResponse.json(
    { error: messages[status.reason!] || 'Subscription inactive', code: status.reason },
    { status: 403 }
  )
}

/**
 * Extract and verify the Supabase access token from the request.
 * Returns an authenticated Supabase client (db) that carries the user's
 * JWT so that RLS policies can identify the user via auth.uid().
 */
export async function withAuth(request: Request, requireManager: boolean = false): Promise<AuthResult | AuthError> {
  // 1. Get the token from the Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const token = authHeader.slice(7) // Remove "Bearer " prefix

  // 2. Verify the token with Supabase
  const { data: { user }, error } = await createServerClient(token).auth.getUser(token)
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Session invalid or expired' }, { status: 401 }) }
  }

  // 3. Get org/role from app_metadata first, then fallback to users table
  let orgId = user.app_metadata?.organisation_id
  let role = user.app_metadata?.role || 'staff'
  let storeId = user.app_metadata?.store_id || null

  // If app_metadata doesn't have org info, fetch from users table
  if (!orgId) {
    const db = createServerClient(token)
    const { data: profile } = await db
      .from('users')
      .select('organisation_id, role, store_id')
      .eq('id', user.id)
      .single()

    if (profile) {
      orgId = profile.organisation_id
      role = profile.role || 'staff'
      storeId = profile.store_id || null
    }
  }

  if (!orgId) {
    return { error: NextResponse.json({ error: 'No organisation assigned. Please contact support.' }, { status: 403 }) }
  }

  // 4. Check manager permission if required
  if (requireManager && role !== 'manager' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Manager access required' }, { status: 403 }) }
  }

  // 5. Return an authenticated Supabase client for this user
  const db = createServerClient(token)

  return {
    userId: user.id,
    email: user.email || '',
    orgId,
    storeId,
    role,
    db,
  }
}