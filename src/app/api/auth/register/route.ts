import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword, createToken, generateSlug, generateId, generateBarcode } from '@/lib/auth'
import { auditLog, DEFAULT_CATEGORIES } from '@/lib/helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessName, managerName, email, password, pin } = body

    if (!businessName || !managerName || !email || !password || !pin) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
    }

    const existingUser = await db.user.findFirst({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const slug = generateSlug(businessName)

    const org = await db.organisation.create({
      data: {
        name: businessName, slug,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        users: { create: { email: email.toLowerCase(), passwordHash, name: managerName, pin, role: 'manager' } },
        stores: { create: { name: 'Main Store', location: '' } },
        categories: { createMany: { data: DEFAULT_CATEGORIES.map(c => ({ name: c.name, colour: c.colour })) } }
      },
      include: { users: true, stores: true }
    })

    const user = org.users[0]
    const store = org.stores[0]
    await db.user.update({ where: { id: user.id }, data: { storeId: store.id } })

    const products = [
      { name: 'Johnnie Walker Red Label', category: 'Whisky', size: '750ml', cost: 2200, sell: 3200, stock: 24, reorder: 5 },
      { name: 'Jameson Irish Whiskey', category: 'Whisky', size: '750ml', cost: 1800, sell: 2800, stock: 18, reorder: 5 },
      { name: 'Chateau Margaux 2018', category: 'Wine', size: '750ml', cost: 4500, sell: 7500, stock: 12, reorder: 3 },
      { name: 'Moet & Chandon Imperial', category: 'Champagne', size: '750ml', cost: 3800, sell: 5500, stock: 15, reorder: 4 },
      { name: 'Smirnoff Vodka', category: 'Vodka', size: '750ml', cost: 800, sell: 1400, stock: 36, reorder: 10 },
      { name: 'Tanqueray London Dry Gin', category: 'Gin', size: '750ml', cost: 1600, sell: 2600, stock: 20, reorder: 5 },
      { name: 'Bacardi Carta Blanca', category: 'Rum', size: '750ml', cost: 900, sell: 1600, stock: 30, reorder: 8 },
      { name: 'Hennessy VS Cognac', category: 'Cognac', size: '750ml', cost: 2800, sell: 4200, stock: 16, reorder: 4 },
      { name: 'Patron Silver Tequila', category: 'Tequila', size: '750ml', cost: 3200, sell: 4800, stock: 10, reorder: 3 },
      { name: 'Baileys Irish Cream', category: 'Liqueur', size: '750ml', cost: 1200, sell: 2000, stock: 22, reorder: 6 },
      { name: 'Tusker Lager', category: 'Beer', size: '500ml', cost: 120, sell: 200, stock: 120, reorder: 30 },
      { name: 'White Cap Lager', category: 'Beer', size: '500ml', cost: 110, sell: 180, stock: 100, reorder: 30 },
    ]

    const cats = await db.category.findMany({ where: { organisationId: org.id } })
    const catMap = Object.fromEntries(cats.map(c => [c.name, c.id]))

    for (const p of products) {
      await db.product.create({
        data: {
          name: p.name, sku: generateId('sku').toUpperCase(), barcode: generateBarcode(),
          size: p.size, openingStock: p.stock, currentStock: p.stock,
          reorderLevel: p.reorder, costPrice: p.cost, sellPrice: p.sell,
          organisationId: org.id, storeId: store.id, categoryId: catMap[p.category] || null,
        }
      })
    }

    const suppliers = [
      { name: 'East African Wines Ltd', contact: 'Peter Mwangi', phone: '+254 720 123 456', email: 'info@eawines.co.ke', types: 'Wine, Champagne' },
      { name: 'Spirits Distributors KE', contact: 'Jane Wanjiku', phone: '+254 733 456 789', email: 'orders@spiritsdist.co.ke', types: 'Whisky, Vodka, Gin, Rum' },
      { name: 'Premium Beverages', contact: 'Samuel Ochieng', phone: '+254 711 789 012', email: 'sales@premiumbev.co.ke', types: 'Beer, Liqueur, Tequila' },
    ]
    for (const s of suppliers) {
      await db.supplier.create({ data: { name: s.name, contact: s.contact, phone: s.phone, email: s.email, productTypes: s.types, organisationId: org.id } })
    }

    await auditLog({ action: 'organisation.created', entity: 'Organisation', entityId: org.id, afterValue: { name: businessName }, userId: user.id, organisationId: org.id })

    const token = createToken({ userId: user.id, organisationId: org.id, role: user.role, name: user.name })
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, pin: user.pin },
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
      store: { id: store.id, name: store.name },
      token
    }, { status: 201, headers: { 'Set-Cookie': `vinocellar_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${604800}` } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 500 })
  }
}