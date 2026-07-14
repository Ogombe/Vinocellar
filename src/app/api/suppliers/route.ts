import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { data: suppliers, error } = await supabaseServer
    .from('suppliers')
    .select('*')
    .eq('organisation_id', auth.orgId)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get product counts per supplier
  const { data: productCounts } = await supabaseServer
    .from('products')
    .select('supplier_id')
    .eq('organisation_id', auth.orgId)
    .not('supplier_id', 'is', null)

  const countBySupplier: Record<string, number> = {}
  for (const p of (productCounts || [])) {
    countBySupplier[p.supplier_id] = (countBySupplier[p.supplier_id] || 0) + 1
  }

  const mapped = (suppliers || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contact_person,
    phone: s.phone,
    email: s.email,
    productTypes: s.product_types,
    organisationId: s.organisation_id,
    createdAt: s.created_at,
    _count: { products: countBySupplier[s.id] || 0 }
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, contact, phone, email, productTypes } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: supplier, error } = await supabaseServer
    .from('suppliers')
    .insert({
      name,
      contact_person: contact || '',
      phone: phone || '',
      email: email || '',
      product_types: productTypes || '',
      organisation_id: auth.orgId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'supplier.created', entity: 'Supplier', entityId: supplier.id,
    afterValue: { name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contact_person,
    phone: supplier.phone,
    email: supplier.email,
    productTypes: supplier.product_types,
    _count: { products: 0 }
  }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { id, name, contact, phone, email, productTypes } = await request.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const updateData: any = {}
  if (name !== undefined) updateData.name = name
  if (contact !== undefined) updateData.contact_person = contact
  if (phone !== undefined) updateData.phone = phone
  if (email !== undefined) updateData.email = email
  if (productTypes !== undefined) updateData.product_types = productTypes

  const { data: existing } = await supabaseServer
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabaseServer
    .from('suppliers')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'supplier.updated', entity: 'Supplier', entityId: id,
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

  const { data: existing } = await supabaseServer
    .from('suppliers')
    .select('name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabaseServer
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'supplier.deleted', entity: 'Supplier', entityId: id,
    beforeValue: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}