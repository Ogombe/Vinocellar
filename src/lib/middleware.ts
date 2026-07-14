import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export interface AuthResult {
  userId: string
  email: string
  orgId: string
  storeId: string | null
  role: string
  error?: never
}

export interface AuthError {
  error: NextResponse
}

/**
 * Extract and verify the Supabase access token from the request.
 * The token is sent by the client in the Authorization: Bearer <token> header.
 * Supabase JWTs contain app_metadata with organisation_id, role, store_id.
 */
export async function withAuth(request: Request, requireManager: boolean = false): Promise<AuthResult | AuthError> {
  // 1. Get the token from the Authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const token = authHeader.slice(7) // Remove "Bearer " prefix

  // 2. Verify the token with Supabase
  const { data: { user }, error } = await supabaseServer.auth.getUser(token)
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

  return {
    userId: user.id,
    email: user.email || '',
    orgId,
    storeId,
    role
  }
}