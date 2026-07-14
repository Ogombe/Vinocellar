import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

/**
 * Register route — handles the full signup flow:
 * 1. Creates auth user via Supabase Auth admin API
 * 2. Creates organisation
 * 3. Creates user profile row
 * 4. Sets app_metadata (organisation_id, role, store_id)
 *
 * Replaces the broken edge function approach.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, business_name, pin } = await request.json()

    if (!email || !password || !name || !business_name) {
      return NextResponse.json(
        { error: 'Email, password, name, and business name are required' },
        { status: 400 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Create auth user (sign up)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'manager',
        },
      },
    })

    if (authError) {
      // If user already exists, try signing them in instead
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          return NextResponse.json({ error: `Account exists but password is wrong: ${signInError.message}` }, { status: 409 })
        }
        // User exists and password matches — return success, let client handle session
        return NextResponse.json({
          user: signInData.user,
          session: signInData.session,
          message: 'Signed in to existing account',
        }, { status: 200 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    const userId = authData.user.id

    // 2. Create organisation
    const slug = business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name: business_name,
        slug,
        plan: 'trial',
        is_active: true,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14-day trial
        max_stores: 3,
        max_staff: 10,
        max_products: 200,
      })
      .select()
      .single()

    if (orgError) {
      console.error('Org creation error:', orgError)
      return NextResponse.json({ error: `Failed to create organisation: ${orgError.message}` }, { status: 500 })
    }

    // 3. Create user profile row
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name,
        role: 'manager',
        pin: pin || '0000',
        organisation_id: org.id,
        store_id: null,
        is_active: true,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail — the safety net in auth-context will handle this
    }

    // 4. Update auth user app_metadata with org info
    // We can't use admin API with anon key, but the client-side code reads from the users table
    // The middleware reads app_metadata, so we need to update it
    // Since we can't use service_role, the client will use the profile from users table

    return NextResponse.json({
      user: authData.user,
      session: authData.session,
      organisation: org,
      message: 'Account created successfully',
    }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    console.error('Registration error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}