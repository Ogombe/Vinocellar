import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const entity = searchParams.get('entity')

  const where: any = { organisationId: auth.orgId }
  if (entity) where.entity = entity

  const logs = await db.auditLog.findMany({
    where, include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' }, take: limit
  })

  return NextResponse.json(logs)
}