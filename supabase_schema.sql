-- =============================================================================
-- IFIMED Bank Statements & Treasury Reconciliation Database Schema
-- Supabase PostgreSQL Database (Project: bdvktgrehxwjovhycvsj)
-- =============================================================================

-- 1. Corporate Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.corporate_banks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Current A/c',
    acc_no TEXT NOT NULL,
    full_acc_no TEXT,
    ifsc TEXT,
    branch TEXT,
    sheets JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Customer Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    invoice_no TEXT UNIQUE NOT NULL,
    guest_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'Unpaid',
    settled_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Vendor Bills Table
CREATE TABLE IF NOT EXISTS public.vendor_bills (
    id TEXT PRIMARY KEY,
    bill_no TEXT UNIQUE NOT NULL,
    vendor_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'Unpaid',
    settled_amount NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Reconciled Mappings / Audit Table
CREATE TABLE IF NOT EXISTS public.reconciled_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_id TEXT,
    bank_ref TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    mapping_type TEXT NOT NULL, -- 'credit' or 'debit'
    invoice_no TEXT,
    bill_no TEXT,
    party_name TEXT,
    note TEXT,
    mapped_by TEXT NOT NULL,
    mapped_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Activity Log Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Statement Bank Transactions (All Detected Credits & Debits)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES public.corporate_banks(id) ON DELETE CASCADE,
    month_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    narration TEXT NOT NULL,
    payer TEXT,
    bank_ref TEXT,
    type TEXT DEFAULT 'TRANSFER',
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    amount NUMERIC(14, 2) NOT NULL,
    status TEXT DEFAULT 'unmapped',
    mapping JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.corporate_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciled_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Allow Authenticated and Publishable (anon) clients full read & write access
DO $$
DECLARE
  t TEXT;
  pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['corporate_banks', 'invoices', 'vendor_bills', 'reconciled_mappings', 'activity_logs', 'bank_transactions']
  LOOP
    pol := 'Allow authenticated read/write on ' || t;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', pol, t);
    END IF;
    pol := 'Allow anon read/write on ' || t;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = pol) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', pol, t);
    END IF;
  END LOOP;
END $$;
