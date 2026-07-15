import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { hashPin } from '@/lib/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Register route — handles the full signup flow:
 * 1. Validates input
 * 2. Creates auth user via Supabase Auth
 * 3. Uses the new user's session to create organisation and profile
 */
export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 5 registrations per 10 minutes per IP ──
    const ip = getClientIp(request)
    const rl = rateLimit(ip, 'register', 5, 10 * 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait and try again.' },
        { status: 429 }
      )
    }

    const { email, password, name, business_name, pin } = await request.json()

    // ── Input validation ──
    if (!email || !password || !name || !business_name) {
      return NextResponse.json(
        { error: 'Email, password, name, and business name are required' },
        { status: 400 }
      )
    }

    const emailStr = String(email).toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    if (name.length > 100 || business_name.length > 100) {
      return NextResponse.json({ error: 'Name and business name must be under 100 characters' }, { status: 400 })
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
    }

    // Use a temporary client for signup
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Create auth user
    const { data: authData, error: authError } = await tempClient.auth.signUp({
      email: emailStr,
      password,
      options: {
        data: { name, role: 'manager' },
      },
    })

    if (authError) {
      // Generic error — don't leak whether email exists
      return NextResponse.json({ error: 'Could not create account. Please check your details and try again.' }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const userId = authData.user.id
    const sessionToken = authData.session?.access_token

    // 2. Create an authenticated client with the new user's token
    const authClient: SupabaseClient = sessionToken
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${sessionToken}` } },
        })
      : tempClient

    // 3. Create organisation
    const slug = business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data: org, error: orgError } = await authClient
      .from('organisations')
      .insert({
        name: business_name.trim(),
        slug,
        plan: 'trial',
        is_active: true,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        max_stores: 3,
        max_staff: 10,
        max_products: 200,
      })
      .select()
      .single()

    if (orgError) {
      console.error('Org creation error:', orgError.message, orgError.code)
      return NextResponse.json(
        { error: 'Failed to create organisation. Please try again.' },
        { status: 500 }
      )
    }

    // 4. Hash PIN and create user profile row
    const hashedPin = await hashPin(pin && /^\d{4}$/.test(pin) ? pin : '0000')

    const { error: profileError } = await authClient
      .from('users')
      .insert({
        id: userId,
        email: emailStr,
        name: name.trim(),
        role: 'manager',
        pin: hashedPin,
        organisation_id: org.id,
        store_id: null,
        is_active: true,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError.message)
    }

    return NextResponse.json({
      user: authData.user,
      session: authData.session,
      organisation: org,
      message: 'Account created successfully',
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    console.error('Registration error:', message)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}