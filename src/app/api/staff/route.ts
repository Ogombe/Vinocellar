import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { data: staff, error } = await auth.db
    .from('users')
    .select('id, email, name, role, pin, store_id, is_active, last_login_at')
    .eq('organisation_id', auth.orgId)
    .in('role', ['manager', 'staff'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get sale counts per staff member
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
  const { name, email, password, pin, role, storeId } = body

  if (!name || !email || !password || !pin) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  // Check if email already exists in this organisation
  const { data: existing } = await auth.db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('organisation_id', auth.orgId)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Email already exists in organisation' }, { status: 409 })
  }

  // Call the addstaff edge function to create Supabase Auth user + profile
  const res = await fetch(`${SUPABASE_URL}/functions/v1/addstaff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      email: email.toLowerCase(),
      password,
      name,
      pin,
      role: role || 'staff',
      store_id: storeId || auth.storeId,
      organisation_id: auth.orgId,
      manager_token: request.headers.get('authorization')?.slice(7), // pass manager's token for auth
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.error || data.msg || 'Failed to create staff' }, { status: res.status })
  }

  await auditLog({
    action: 'staff.created', entity: 'User', entityId: data.user_id,
    afterValue: { name, role: role || 'staff' }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({
    id: data.user_id,
    name,
    email: email.toLowerCase(),
    role: role || 'staff',
    pin,
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Check user exists in org
  const { data: existing } = await auth.db
    .from('users')
    .select('id, name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build update object with snake_case columns
  const updateData: any = {}
  if (data.name) updateData.name = data.name
  if (data.email) updateData.email = data.email.toLowerCase()
  if (data.role) updateData.role = data.role
  if (data.storeId !== undefined) updateData.store_id = data.storeId
  if (data.pin) updateData.pin = data.pin
  if (data.isActive !== undefined) updateData.is_active = data.isActive

  const { error } = await auth.db
    .from('users')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If password changed, update via Supabase Admin API
  if (data.password) {
    // The edge function would handle this; for now update the profile
    // Password changes require the Supabase Management API with service role key
  }

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
  if (id === auth.userId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  const { data: existing } = await auth.db
    .from('users')
    .select('name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Deactivate instead of deleting (soft delete via is_active flag)
  const { error } = await auth.db
    .from('users')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'staff.deactivated', entity: 'User', entityId: id,
    beforeValue: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}