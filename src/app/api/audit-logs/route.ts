import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const entity = searchParams.get('entity')

  let query = auth.db
    .from('audit_logs')
    .select('*, user:users!user_id(name, email)')
    .eq('organisation_id', auth.orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entity) {
    query = query.eq('entity', entity)
  }

  const { data: logs, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (logs || []).map((l: any) => ({
    id: l.id,
    action: l.action,
    entity: l.entity,
    entityId: l.entity_id,
    beforeValue: l.before_value,
    afterValue: l.after_value,
    createdAt: l.created_at,
    user: l.user ? { name: l.user.name, email: l.user.email } : null,
  }))

  return NextResponse.json(mapped)
}