import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'

/**
 * GET /api/payments — Fetch payment history for the current organisation
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { data, error } = await auth.db
    .from('payments')
    .select('id, reference, plan, amount, currency, status, payment_method, paid_at, created_at')
    .eq('organisation_id', auth.orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payments: data })
}