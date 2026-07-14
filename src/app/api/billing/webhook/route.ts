import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

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
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      // Update organisation plan
      const { error } = await supabase
        .from('organisations')
        .update({
          plan: metadata.plan,
          is_active: true,
          // Set trial end to 30 days from now (subscription period)
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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