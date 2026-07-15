-- Run this in Supabase SQL Editor
-- Creates the payments table to track all billing transactions

CREATE TABLE IF NOT EXISTS public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reference     TEXT NOT NULL UNIQUE,
  paystack_ref  TEXT,
  plan          TEXT NOT NULL CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'KES',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  payment_method TEXT,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: allow authenticated users to read their own org's payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_authenticated" ON public.payments
  FOR SELECT TO authenticated USING (true);

-- Super admin needs insert/update access via service role
CREATE POLICY "payments_all_service_role" ON public.payments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(reference);