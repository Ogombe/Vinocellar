import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

/**
 * Create a Supabase client authenticated as a specific user.
 * This is needed because RLS policies use auth.uid() to identify the user.
 * The server-side anon client has no session, so auth.uid() returns null
 * and ALL RLS-protected queries get blocked.
 *
 * By passing the user's JWT in the Authorization header, PostgREST sets
 * auth.uid() to the correct user, and RLS policies work as intended.
 */
export function createServerClient(token: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

// Legacy export — kept for backward compatibility with any code that doesn't pass a token.
// NOTE: This client has NO user session, so RLS policies that call auth.uid()
// will return null. Use createServerClient(token) instead for authenticated queries.
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey)