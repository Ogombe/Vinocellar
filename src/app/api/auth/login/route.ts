import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit: 10 attempts per minute per IP ──
    const ip = getClientIp(request)
    const rl = rateLimit(ip, 'login', 10, 60 * 1000)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait a minute and try again.', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 })
    }

    const supabaseServer = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email: String(email).toLowerCase().trim(),
      password,
    })

    if (error) {
      // Generic error — don't reveal if email exists or password is wrong
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}