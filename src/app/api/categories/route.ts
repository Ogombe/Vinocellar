import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const categories = await db.category.findMany({ where: { organisationId: auth.orgId }, orderBy: { name: 'asc' } })
  return NextResponse.json(categories)
}