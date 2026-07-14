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

  // 3. Extract organisation_id and role from app_metadata (set during signup)
  const orgId = user.app_metadata?.organisation_id
  const role = user.app_metadata?.role || 'staff'
  const storeId = user.app_metadata?.store_id || null

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