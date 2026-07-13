import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, getTokenFromRequest } from '@/lib/helpers'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const session = await getSessionUser(token)
  if (!session) return NextResponse.json({ error: 'Session invalid' }, { status: 401 })

  const { storeId } = await request.json()
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 })

  const store = await db.store.findFirst({ where: { id: storeId, organisationId: session.org.id } })
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  await db.user.update({ where: { id: session.user.id }, data: { storeId } })
  return NextResponse.json({ success: true, storeId })
}