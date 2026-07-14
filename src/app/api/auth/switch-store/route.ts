import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { storeId } = await request.json()
  if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 })

  // Verify the store belongs to this org
  const { data: store } = await supabaseServer
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('organisation_id', auth.orgId)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Update the user's store_id in the users table
  const { error } = await supabaseServer
    .from('users')
    .update({ store_id: storeId })
    .eq('id', auth.userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Also update the user's app_metadata in Supabase Auth
  // This requires the admin API, but for now the users table update is sufficient
  // The client will need to refresh the profile to pick up the new store

  return NextResponse.json({ success: true, storeId })
}