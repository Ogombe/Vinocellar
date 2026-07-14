import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId') || auth.storeId
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  if (!storeId) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  let query = auth.db
    .from('products')
    .select('*, category:categories(name, colour), supplier:suppliers(name)')
    .eq('organisation_id', auth.orgId)
    .eq('store_id', storeId)

  if (category && category !== 'All') {
    query = query.eq('category_id', category)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
  }

  query = query.order('created_at', { ascending: false })

  const { data: products, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Map to match what front-end expects (camelCase + category/supplier as strings)
  const mapped = (products || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    size: p.size,
    openingStock: p.opening_stock,
    currentStock: p.current_stock,
    reorderLevel: p.reorder_level,
    costPrice: p.cost_price,
    sellPrice: p.sell_price,
    organisationId: p.organisation_id,
    storeId: p.store_id,
    categoryId: p.category_id,
    supplierId: p.supplier_id,
    category: p.category?.name || 'Other',
    categoryColour: p.category?.colour || '#6B7280',
    supplier: p.supplier?.name || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  return NextResponse.json(mapped)
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { name, sku, barcode, category, size, openingStock, reorderLevel, costPrice, sellPrice, storeId, supplierId, categoryId } = body

  if (!name || !sellPrice) return NextResponse.json({ error: 'Name and sell price required' }, { status: 400 })

  const sid = storeId || auth.storeId
  if (!sid) return NextResponse.json({ error: 'No store selected' }, { status: 400 })

  // Resolve category if name given instead of ID
  let catId = categoryId || null
  if (category && !catId) {
    const { data: cat } = await auth.db
      .from('categories')
      .select('id')
      .eq('name', category)
      .eq('organisation_id', auth.orgId)
      .single()
    if (cat) catId = cat.id
  }

  const productData = {
    id: uuidv4(),
    name,
    sku: sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
    barcode: barcode || `600${Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')}`,
    size: size || '750ml',
    opening_stock: openingStock || 0,
    current_stock: openingStock || 0,
    reorder_level: reorderLevel || 5,
    cost_price: costPrice || 0,
    sell_price: sellPrice,
    organisation_id: auth.orgId,
    store_id: sid,
    category_id: catId,
    supplier_id: supplierId || null,
  }

  const { data: product, error } = await auth.db
    .from('products')
    .insert(productData)
    .select('*, category:categories(name, colour), supplier:suppliers(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'product.created', entity: 'Product', entityId: product.id,
    afterValue: { name: product.name }, userId: auth.userId, organisationId: auth.orgId
  })

  const mapped = {
    ...product,
    category: product.category?.name || 'Other',
    categoryColour: product.category?.colour || '#6B7280',
    supplier: product.supplier?.name || null,
    stock: product.current_stock,
  }

  return NextResponse.json(mapped, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const { id, category, ...data } = body
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  // Convert camelCase to snake_case for Supabase columns
  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.sku !== undefined) updateData.sku = data.sku
  if (data.barcode !== undefined) updateData.barcode = data.barcode
  if (data.size !== undefined) updateData.size = data.size
  if (data.openingStock !== undefined) updateData.opening_stock = data.openingStock
  if (data.currentStock !== undefined) updateData.current_stock = data.currentStock
  if (data.reorderLevel !== undefined) updateData.reorder_level = data.reorderLevel
  if (data.costPrice !== undefined) updateData.cost_price = data.costPrice
  if (data.sellPrice !== undefined) updateData.sell_price = data.sellPrice
  if (data.categoryId !== undefined) updateData.category_id = data.categoryId
  if (data.supplierId !== undefined) updateData.supplier_id = data.supplierId

  // Resolve category by name if provided
  if (category && !updateData.category_id) {
    const { data: cat } = await auth.db
      .from('categories')
      .select('id')
      .eq('name', category)
      .eq('organisation_id', auth.orgId)
      .single()
    if (cat) updateData.category_id = cat.id
  }

  const { data: product, error } = await auth.db
    .from('products')
    .update(updateData)
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .select('*, category:categories(name, colour), supplier:suppliers(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  await auditLog({
    action: 'product.updated', entity: 'Product', entityId: id,
    afterValue: { name: product.name }, userId: auth.userId, organisationId: auth.orgId
  })

  const mapped = {
    ...product,
    category: product.category?.name || 'Other',
    categoryColour: product.category?.colour || '#6B7280',
    supplier: product.supplier?.name || null,
    stock: product.current_stock,
  }

  return NextResponse.json(mapped)
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

  const { data: existing } = await auth.db
    .from('products')
    .select('name')
    .eq('id', id)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const { error } = await auth.db
    .from('products')
    .delete()
    .eq('id', id)
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await auditLog({
    action: 'product.deleted', entity: 'Product', entityId: id,
    beforeValue: { name: existing.name }, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}