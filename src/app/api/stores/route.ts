import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

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

  const { name, location } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

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

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await auth.db
    .from('stores')
    .update(data)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({ action: 'store.updated', entity: 'Store', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}