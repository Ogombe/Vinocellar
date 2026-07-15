import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * One-time setup: creates the payments table.
 * Run once then delete this file.
 * Call: GET /api/setup/payments
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, key)

  // Check if table exists
  const { error: checkError } = await supabase.from('payments').select('id').limit(1)

  if (!checkError) {
    return NextResponse.json({ message: 'Payments table already exists' })
  }

  // Can't run DDL via JS client, return SQL
  return NextResponse.json({
    message: 'Run this SQL in Supabase SQL Editor',
    sql: [
      'CREATE TABLE public.payments (',
      '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  organisation_id UUID NOT NULL,',
      '  user_id UUID,',
      '  reference TEXT NOT NULL UNIQUE,',
      '  plan TEXT NOT NULL,',
      '  amount INTEGER NOT NULL,',
      '  currency TEXT DEFAULT \'KES\',',
      '  status TEXT DEFAULT \'pending\',',
      '  payment_method TEXT,',
      '  paid_at TIMESTAMPTZ,',
      '  created_at TIMESTAMPTZ DEFAULT now()',
      ');',
      '',
      'ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;',
      '',
      'CREATE POLICY "payments_all_authenticated" ON public.payments',
      '  FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      '',
      'CREATE INDEX idx_payments_org_id ON public.payments(organisation_id);',
    ].join('\n'),
  })
}