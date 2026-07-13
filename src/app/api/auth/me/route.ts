import { NextResponse } from 'next/server'
import { getSessionUser, getTokenFromRequest } from '@/lib/helpers'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const token = getTokenFromRequest(request)
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const session = await getSessionUser(token)
  if (!session) return NextResponse.json({ error: 'Session invalid' }, { status: 401 })
  const stores = await db.store.findMany({ where: { organisationId: session.org.id }, select: { id: true, name: true, location: true } })
  return NextResponse.json({ user: session.user, org: session.org, storeId: session.storeId, stores })
}