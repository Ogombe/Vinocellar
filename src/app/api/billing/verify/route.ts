import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'

const PLAN_LIMITS: Record<string, { max_stores: number; max_staff: number; max_products: number }> = {
  trial:        { max_stores: 3, max_staff: 10, max_products: 200 },
  starter:      { max_stores: 2, max_staff: 5, max_products: 100 },
  professional: { max_stores: 5, max_staff: 20, max_products: 500 },
  enterprise:   { max_stores: 999, max_staff: 999, max_products: 9999 },
}

function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.trial
}

/**
 * Verify a payment by reference. Called after Paystack redirect.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { reference } = await request.json()
  if (!reference) {
    return NextResponse.json({ error: 'Reference required' }, { status: 400 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })
  }

  // Verify transaction with Paystack
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  const data = await res.json()

  if (!data.status || !data.data) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  const payment = data.data

  if (payment.status === 'success') {
    const metadata = payment.metadata

    if (metadata?.organisation_id && metadata?.plan) {
      // Update organisation plan and set billing period
      const limits = getPlanLimits(metadata.plan)
      await auth.db
        .from('organisations')
        .update({
          plan: metadata.plan,
          is_active: true,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ...limits,
        })
        .eq('id', metadata.organisation_id)
    }

    return NextResponse.json({
      verified: true,
      plan: metadata?.plan,
      amount: payment.amount / 100,
      currency: payment.currency,
    })
  }

  return NextResponse.json({ verified: false, status: payment.status })
}