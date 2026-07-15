import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const PLAN_LIMITS: Record<string, { max_stores: number; max_staff: number; max_products: number }> = {
  trial:        { max_stores: 3, max_staff: 10, max_products: 200 },
  starter:      { max_stores: 2, max_staff: 5, max_products: 100 },
  professional: { max_stores: 5, max_staff: 20, max_products: 500 },
  enterprise:   { max_stores: 999, max_staff: 999, max_products: 9999 },
}

/**
 * Paystack webhook handler.
 * Paystack sends a POST here when a payment event occurs.
 * We verify the signature, then update the org's plan.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  // Verify webhook signature
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(body)
    .digest('hex')

  if (hash !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  console.log('Paystack webhook event:', event.event)

  // Handle charge.success
  if (event.event === 'charge.success') {
    const data = event.data
    const metadata = data.metadata

    if (metadata?.organisation_id && metadata?.plan) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const limits = PLAN_LIMITS[metadata.plan] || PLAN_LIMITS.trial

      // Update organisation plan and billing period
      const { error } = await supabase
        .from('organisations')
        .update({
          plan: metadata.plan,
          is_active: true,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ...limits,
        })
        .eq('id', metadata.organisation_id)

      if (error) {
        console.error('Failed to update org plan:', error.message)
      } else {
        console.log(`Updated org ${metadata.organisation_id} to plan ${metadata.plan}`)
      }

      // Log payment
      await supabase.from('audit_logs').insert({
        organisation_id: metadata.organisation_id,
        user_id: metadata.user_id || null,
        action: 'subscription_payment',
        entity: 'billing',
        details: `Paid for ${metadata.plan_name || metadata.plan} plan. Reference: ${data.reference}. Amount: ${data.amount / 100} ${data.currency}`,
      })
    }
  }

  return NextResponse.json({ received: true })
}