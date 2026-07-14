import { NextResponse } from 'next/server'

// Logout is handled client-side via supabase.auth.signOut()
// This endpoint is kept for compatibility but doesn't need to do anything
export async function POST() {
  return NextResponse.json({ success: true })
}

export async function GET() {
  return NextResponse.json({ success: true })
}