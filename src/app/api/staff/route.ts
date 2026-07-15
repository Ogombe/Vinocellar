import { NextRequest, NextResponse } from 'next/server'
import { withAuth, checkSubscription, subscriptionErrorResponse } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'
import { checkPlanLimit } from '@/lib/plan-limits'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const sub = await checkSubscription(auth.db, auth.orgId, auth.role)
  if (!sub.active) return subscriptionErrorResponse(sub)

  const { data: staff, error } = await auth.db
    .from('users')
    .select('id, email, name, role, pin, store_id, is_active, last_login_at')
    .eq('organisation_id', auth.orgId)
    .in('role', ['manager', 'staff'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: saleCounts } = await auth.db
    .from('sales')
    .select('staff_id')
    .eq('organisation_id', auth.orgId)

  const countByStaff: Record<string, number> = {}
  for (const s of (saleCounts || [])) {
    countByStaff[s.staff_id] = (countByStaff[s.staff_id] || 0) + 1
  }

  const mapped = (staff || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    pin: u.pin,
    storeId: u.store_id,
    isActive: u.is_active,
    lastLoginAt: u.last_login_at,
    _count: { sales: countByStaff[u.id] || 0 }
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, pin, role, storeId } = body

  if (!name || !pin) {
    return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 })
  }

  // Check plan limit
  const limitCheck = await checkPlanLimit(auth.db, auth.orgId, 'staff')
  if (!limitCheck.passed) return NextResponse.json({ error: limitCheck.error }, { status: 403 })
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
  }

  // Generate a UUID and insert directly — no auth user needed
  const newId = crypto.randomUUID()

  const { error: insertErr } = await auth.db
    .from('users')
    .insert({
      id: newId,
      email: null,
      name,
      pin,
      role: role || 'staff',
      store_id: storeId || auth.storeId,
      organisation_id: auth.orgId,
      is_active: true,
    })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  await auditLog({
    action: 'staff.created',
    entity: 'User',
    entityId: newId,
    afterValue: { name, role: role || 'staff' },
    userId: auth.userId,
    organisationId: auth.orgId,
  })

  return NextResponse.json({
    id: newId,
    name,
    email: null,
    role: role || 'staff',
    pin,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { data: existing } = await auth.db
    .from('users')
    .select('id, name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: any = {}
  if (data.name) updateData.name = data.name
  if (data.email !== undefined) updateData.email = data.email ? data.email.toLowerCase() : null
  if (data.role) updateData.role = data.role
  if (data.storeId !== undefined) updateData.store_id = data.storeId
  if (data.pin) updateData.pin = data.pin
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  const { error } = await auth.db.from('users').update(updateData).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'staff.updated', entity: 'User', entityId: id,
    userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ id, name: data.name || existing.name, email: data.email, role: data.role, pin: data.pin, isActive: data.isActive })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  if (id === auth.userId) return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 })

  const { data: existing } = await auth.db
    .from('users')
    .select('name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await auth.db.from('users').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'staff.deactivated', entity: 'User', entityId: id,
    beforeValue: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}