import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, pin } = body

    if ((!email && !pin) || (!password && !pin)) {
      return NextResponse.json({ error: 'Provide email+password or PIN' }, { status: 400 })
    }

    let user
    if (pin) {
      user = await db.user.findUnique({ where: { pin }, include: { organisation: true, store: true } })
      if (!user || !user.isActive) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
      if (user.role !== 'manager') return NextResponse.json({ error: 'PIN login is for managers only' }, { status: 403 })
    } else {
      user = await db.user.findFirst({ where: { email: email.toLowerCase() }, include: { organisation: true, store: true } })
      if (!user || !user.isActive) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
      const valid = await verifyPassword(password, user.passwordHash)
      if (!valid) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!user.organisation.isActive) return NextResponse.json({ error: 'Organisation is inactive' }, { status: 403 })
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    const token = createToken({ userId: user.id, organisationId: user.organisationId, role: user.role, name: user.name })
    const store = user.store ? { id: user.store.id, name: user.store.name } : null
    const stores = await db.store.findMany({ where: { organisationId: user.organisationId }, select: { id: true, name: true, location: true } })

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, pin: user.pin, storeId: user.storeId },
      org: { id: user.organisation.id, name: user.organisation.name, slug: user.organisation.slug, plan: user.organisation.plan, isActive: user.organisation.isActive, trialEndsAt: user.organisation.trialEndsAt },
      store, stores
    }, { headers: { 'Set-Cookie': `vinocellar_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${604800}` } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 })
  }
}