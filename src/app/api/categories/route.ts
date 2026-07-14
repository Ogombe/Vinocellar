import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { data: categories, error } = await auth.db
    .from('categories')
    .select('*')
    .eq('organisation_id', auth.orgId)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map to camelCase
  const mapped = (categories || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    colour: c.colour,
    organisationId: c.organisation_id,
    createdAt: c.created_at,
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { name, colour } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: category, error } = await auth.db
    .from('categories')
    .insert({ name, colour: colour || '#6B7280', organisation_id: auth.orgId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'category.created', entity: 'Category', entityId: category.id,
    afterValue: { name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({
    id: category.id,
    name: category.name,
    colour: category.colour,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, name, colour } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const updateData: any = {}
  if (name) updateData.name = name
  if (colour) updateData.colour = colour

  const { error } = await auth.db
    .from('categories')
    .update(updateData)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'category.updated', entity: 'Category', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: existing } = await auth.db
    .from('categories')
    .select('name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await auth.db
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'category.deleted', entity: 'Category', entityId: id,
    beforeValue: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}