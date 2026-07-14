import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

/**
 * Register route — handles the full signup flow:
 * 1. Creates auth user via Supabase Auth
 * 2. Uses the new user's session to create organisation and profile
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

    // Use a temporary client for signup
    const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 1. Create auth user
    const { data: authData, error: authError } = await tempClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'manager' },
      },
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        // User exists — try signing in
        const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
          email, password,
        })
        if (signInError) {
          return NextResponse.json({ error: `Account exists but login failed: ${signInError.message}` }, { status: 409 })
        }
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
    const sessionToken = authData.session?.access_token

    // 2. Create an authenticated client with the new user's token
    //    This is critical — the anon client won't pass RLS for inserts
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
        name: business_name,
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
        { error: `Failed to create organisation: ${orgError.message}` },
        { status: 500 }
      )
    }

    // 4. Create user profile row
    const { error: profileError } = await authClient
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}