import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const suppliers = await db.supplier.findMany({
    where: { organisationId: auth.orgId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(suppliers)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, contact, phone, email, productTypes } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const supplier = await db.supplier.create({
    data: { name, contact: contact || '', phone: phone || '', email: email || '', productTypes: productTypes || '', organisationId: auth.orgId },
    include: { _count: { select: { products: true } } }
  })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'supplier.created', entity: 'Supplier', entityId: supplier.id, afterValue: { name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(supplier, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, ...data } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const existing = await db.supplier.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supplier = await db.supplier.update({ where: { id }, data, include: { _count: { select: { products: true } } } })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'supplier.updated', entity: 'Supplier', entityId: id, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(supplier)
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const existing = await db.supplier.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.supplier.delete({ where: { id } })
  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'supplier.deleted', entity: 'Supplier', entityId: id, before: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}