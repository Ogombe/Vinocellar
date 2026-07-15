import { NextRequest, NextResponse } from 'next/server'
import { withAuth, checkSubscription, subscriptionErrorResponse } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'
import { checkPlanLimit } from '@/lib/plan-limits'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { data: stores } = await auth.db
    .from('stores')
    .select('*')
    .eq('organisation_id', auth.orgId)
    .order('created_at', { ascending: true })

  return NextResponse.json(stores || [])
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { name, location } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Check plan limit
  const limitCheck = await checkPlanLimit(auth.db, auth.orgId, 'stores')
  if (!limitCheck.passed) return NextResponse.json({ error: limitCheck.error }, { status: 403 })

  const { data: store, error } = await auth.db
    .from('stores')
    .insert({ name, location: location || '', organisation_id: auth.orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({ action: 'store.created', entity: 'Store', entityId: store.id, afterValue: { name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(store, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { id, name, location } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Whitelist allowed fields — prevent mass assignment
  const updateData: Record<string, any> = {}
  if (name && typeof name === 'string' && name.trim().length <= 100) {
    updateData.name = name.trim()
  }
  if (location !== undefined && typeof location === 'string' && location.length <= 200) {
    updateData.location = location.trim()
  }

  const { error } = await auth.db
    .from('stores')
    .update(updateData)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({ action: 'store.updated', entity: 'Store', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}