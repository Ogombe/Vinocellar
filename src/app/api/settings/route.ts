import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'
import { auditLog } from '@/lib/helpers'

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const { data: settings, error } = await supabaseServer
    .from('org_settings')
    .select('*')
    .eq('organisation_id', auth.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const settingMap: Record<string, string> = {}
  for (const s of (settings || [])) {
    settingMap[s.key] = s.value
  }

  return NextResponse.json(settingMap)
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, true)
  if (auth.error) return auth.error

  const body = await request.json()
  const entries = Object.entries(body)

  for (const [key, value] of entries) {
    // Try update first, then insert if not exists (upsert pattern)
    const { data: existing } = await supabaseServer
      .from('org_settings')
      .select('id')
      .eq('organisation_id', auth.orgId)
      .eq('key', key)
      .single()

    if (existing) {
      await supabaseServer
        .from('org_settings')
        .update({ value: String(value) })
        .eq('id', existing.id)
    } else {
      await supabaseServer
        .from('org_settings')
        .insert({ organisation_id: auth.orgId, key, value: String(value) })
    }
  }

  await auditLog({
    action: 'settings.updated', entity: 'OrgSetting',
    afterValue: body, userId: auth.userId, organisationId: auth.orgId
  })

  return NextResponse.json({ success: true })
}