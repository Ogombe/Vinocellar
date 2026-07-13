import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, getTokenFromRequest, auditLog } from '@/lib/helpers'
import { db } from '@/lib/db'

export async function withAuth(request: Request, requireManager: boolean = false) {
  const token = getTokenFromRequest(request)
  if (!token) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }

  const session = await getSessionUser(token)
  if (!session) return { error: NextResponse.json({ error: 'Session invalid' }, { status: 401 }) }

  if (requireManager && session.user.role !== 'manager') {
    return { error: NextResponse.json({ error: 'Manager access required' }, { status: 403 }) }
  }

  return { session, orgId: session.org.id, userId: session.user.id, storeId: session.storeId, role: session.user.role }
}

export async function logAndRespond(params: { action: string; entity: string; entityId?: string; before?: any; after?: any; userId: string; orgId: string }, response?: NextResponse) {
  await auditLog({
    action: params.action, entity: params.entity, entityId: params.entityId,
    beforeValue: params.before, afterValue: params.after,
    userId: params.userId, organisationId: params.orgId
  })
  return response
}