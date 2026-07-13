import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { hashPassword } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const staff = await db.user.findMany({
    where: { organisationId: auth.orgId, role: { in: ['manager', 'staff'] } },
    select: { id: true, email: true, name: true, role: true, pin: true, storeId: true, isActive: true, lastLoginAt: true, _count: { select: { sales: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return NextResponse.json(staff)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, email, password, pin, role, storeId } = body
  if (!name || !email || !password || !pin) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })

  const existing = await db.user.findFirst({ where: { email: email.toLowerCase(), organisationId: auth.orgId } })
  if (existing) return NextResponse.json({ error: 'Email already exists in organisation' }, { status: 409 })

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({
    data: { email: email.toLowerCase(), passwordHash, name, pin, role: role || 'staff', storeId: storeId || auth.storeId, organisationId: auth.orgId }
  })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'staff.created', entity: 'User', entityId: user.id, afterValue: { name, role }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, pin: user.pin }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const existing = await db.user.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: any = {}
  if (data.name) updateData.name = data.name
  if (data.email) updateData.email = data.email.toLowerCase()
  if (data.role) updateData.role = data.role
  if (data.storeId !== undefined) updateData.storeId = data.storeId
  if (data.pin) updateData.pin = data.pin
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.password) updateData.passwordHash = await hashPassword(data.password)

  const user = await db.user.update({ where: { id }, data: updateData })
  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'staff.updated', entity: 'User', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, pin: user.pin, isActive: user.isActive })
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  if (id === auth.userId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  const existing = await db.user.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.user.delete({ where: { id } })
  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'staff.deleted', entity: 'User', entityId: id, before: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}