import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { generateBarcode, generateId } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  if (!storeId) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  const where: any = { organisationId: auth.orgId, storeId }
  if (category && category !== 'All') where.category = category
  if (search) where.OR = [
    { name: { contains: search } },
    { sku: { contains: search } },
    { barcode: { contains: search } }
  ]

  const products = await db.product.findMany({
    where, include: { category: true, supplier: true },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, sku, barcode, category, size, openingStock, reorderLevel, costPrice, sellPrice, storeId, supplierId } = body

  if (!name || !sellPrice) return NextResponse.json({ error: 'Name and sell price required' }, { status: 400 })

  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  let catId = null
  if (category) {
    const cat = await db.category.findFirst({ where: { name: category, organisationId: auth.orgId } })
    if (cat) catId = cat.id
  }

  const product = await db.product.create({
    data: {
      name, sku: sku || generateId('sku').toUpperCase(), barcode: barcode || generateBarcode(),
      category: category || 'Other', size: size || '750ml',
      openingStock: openingStock || 0, currentStock: openingStock || 0,
      reorderLevel: reorderLevel || 5, costPrice: costPrice || 0, sellPrice,
      organisationId: auth.orgId, storeId: sid, categoryId: catId, supplierId: supplierId || null,
    },
    include: { category: true, supplier: true }
  })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'product.created', entity: 'Product', entityId: product.id, afterValue: { name: product.name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(product, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { id, ...data } = body
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const existing = await db.product.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let catId = data.categoryId
  if (data.category && !catId) {
    const cat = await db.category.findFirst({ where: { name: data.category, organisationId: auth.orgId } })
    if (cat) catId = cat.id
  }

  const updateData: any = { ...data }
  delete updateData.id
  if (catId) updateData.categoryId = catId

  const product = await db.product.update({
    where: { id }, data: updateData,
    include: { category: true, supplier: true }
  })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'product.updated', entity: 'Product', entityId: id, before: { name: existing.name }, after: { name: product.name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json(product)
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const existing = await db.product.findFirst({ where: { id, organisationId: auth.orgId } })
  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  await db.product.delete({ where: { id } })

  const { auditLog } = await import('@/lib/helpers')
  await auditLog({ action: 'product.deleted', entity: 'Product', entityId: id, before: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}