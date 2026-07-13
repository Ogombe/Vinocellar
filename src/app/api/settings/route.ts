import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const settings = await db.orgSetting.findMany({ where: { organisationId: auth.orgId } })
  const settingMap = Object.fromEntries(settings.map(s => [s.key, s.value]))
  return NextResponse.json(settingMap)
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const entries = Object.entries(body)

  for (const [key, value] of entries) {
    await db.orgSetting.upsert({
      where: { key_organisationId: { key, organisationId: auth.orgId } },
      create: { key, value: String(value), organisationId: auth.orgId },
      update: { value: String(value) }
    })
  }

  await auditLog({ action: 'settings.updated', entity: 'OrgSetting', afterValue: body, userId: auth.userId, organisationId: auth.orgId })

  return NextResponse.json({ success: true })
}