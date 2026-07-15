import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { getPlanLimitFields } from '@/lib/plan-limits'

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
      const limits = getPlanLimitFields(metadata.plan)
      await auth.db
        .from('organisations')
        .update({
          plan: metadata.plan,
          is_active: true,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ...limits,
        })
        .eq('id', metadata.organisation_id)

      // Record payment in payments table (ignore if duplicate)
      await auth.db.from('payments').upsert({
        organisation_id: metadata.organisation_id,
        user_id: auth.userId,
        reference: payment.reference,
        paystack_ref: payment.id?.toString() || null,
        plan: metadata.plan,
        amount: payment.amount,
        currency: payment.currency || 'KES',
        status: 'success',
        payment_method: payment.channel || null,
        paid_at: payment.paid_at || new Date().toISOString(),
      }, { onConflict: 'reference' })
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