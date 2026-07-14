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

  if (!name || !password || !pin) {
    return NextResponse.json({ error: 'Name, password and PIN are required' }, { status: 400 })
  }
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const cleanedEmail = email?.trim()?.toLowerCase() || null

  if (cleanedEmail) {
    const { data: existing } = await auth.db
      .from('users')
      .select('id')
      .eq('email', cleanedEmail)
      .eq('organisation_id', auth.orgId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A staff member with this email already exists' }, { status: 409 })
    }
  }

  // Create Supabase Auth user. If no email, use a system-internal address
  // that passes Supabase validation but stays hidden from the user.
  const systemEmail = `sys.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 8)}@example.org`
  const authEmail = cleanedEmail || systemEmail

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({
      email: authEmail,
      password,
      data: {
        organisation_id: auth.orgId,
        role: role || 'staff',
        store_id: storeId || auth.storeId,
        name,
      },
    }),
  })

  const authData = await authRes.json()

  if (!authRes.ok || !authData.user) {
    // Never expose the internal system email to the user
    const msg = authData.msg || authData.error_description || authData.error || ''
    const safeMsg = msg.includes('@example.org')
      ? 'Could not create account. Please try again.'
      : msg
    return NextResponse.json({ error: safeMsg || 'Failed to create staff account' }, { status: authRes.status || 500 })
  }

  const newUserId = authData.user.id

  const { error: insertErr } = await auth.db
    .from('users')
    .insert({
      id: newUserId,
      email: cleanedEmail || null,
      name,
      pin,
      role: role || 'staff',
      store_id: storeId || auth.storeId,
      organisation_id: auth.orgId,
      is_active: true,
    })

  if (insertErr) {
    console.error('Profile insert failed:', insertErr.message)
    return NextResponse.json({ error: 'Staff account created but profile setup failed. Contact support.' }, { status: 500 })
  }

  await auditLog({
    action: 'staff.created',
    entity: 'User',
    entityId: newUserId,
    afterValue: { name, role: role || 'staff', email: cleanedEmail || null },
    userId: auth.userId,
    organisationId: auth.orgId,
  })

  return NextResponse.json({
    id: newUserId,
    name,
    email: cleanedEmail || null,
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