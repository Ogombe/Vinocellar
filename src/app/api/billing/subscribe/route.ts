import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import crypto from 'crypto'

const PLANS: Record<string, { name: string; price: number; currency: string; features: string[] }> = {
  starter: {
    name: 'Starter',
    price: 2999,
    currency: 'KES',
    features: ['Up to 2 stores', 'Up to 5 staff', 'Up to 100 products', 'Basic reports', 'Email support'],
  },
  professional: {
    name: 'Professional',
    price: 4999,
    currency: 'KES',
    features: ['Up to 5 stores', 'Up to 20 staff', 'Up to 500 products', 'Advanced reports & CSV', 'Priority support', 'Daily reconciliation'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 9999,
    currency: 'KES',
    features: ['Unlimited stores', 'Unlimited staff', 'Unlimited products', 'All reports', 'Dedicated support', 'Custom integrations', 'API access'],
  },
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request)
  if (auth.error) return auth.error

  const { plan } = await request.json()
  if (!plan || !PLANS[plan]) {
    return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
  }

  if (plan === 'trial') {
    return NextResponse.json({ error: 'Trial is free — no payment needed' }, { status: 400 })
  }

  const planDetails = PLANS[plan]
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'Paystack not configured' }, { status: 500 })
  }

  // Initialize Paystack transaction
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: auth.email,
      amount: planDetails.price * 100, // Paystack expects amount in cents
      currency: planDetails.currency,
      metadata: {
        organisation_id: auth.orgId,
        user_id: auth.userId,
        plan,
        plan_name: planDetails.name,
      },
      callback_url: `${new URL(request.url).origin}/billing/complete`,
    }),
  })

  const data = await res.json()

  if (!data.status) {
    return NextResponse.json({ error: data.message || 'Payment initialization failed' }, { status: 500 })
  }

  return NextResponse.json({
    authorization_url: data.data.authorization_url,
    reference: data.data.reference,
    access_code: data.data.access_code,
  })
}

// GET: return plan details for the pricing page
export async function GET() {
  return NextResponse.json({ plans: PLANS })
}