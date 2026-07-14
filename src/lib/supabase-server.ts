import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rnllkgdsnbybjgvbgagp.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGxrZ2RzbmJ5YmpndmJnYWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjQ2NDcsImV4cCI6MjA5OTU0MDY0N30.h9Uk6j3WLC6VCbGGpVY8kGoywh7xT0duULZeazczVjs'

// Server-side Supabase admin client for API routes
export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey)