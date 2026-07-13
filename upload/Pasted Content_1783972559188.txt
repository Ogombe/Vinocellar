-- ============================================================
-- VinoCellar Pro — Multi-Tenant SaaS Schema for Supabase
-- PostgreSQL with Row Level Security (RLS)
-- ============================================================
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- Execute the ENTIRE script as one block (Ctrl+Shift+Enter) or
-- section by section. Do NOT skip Section 0.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SECTION 0: GRANT ACCESS TO auth SCHEMA (MUST RUN FIRST!)
-- ════════════════════════════════════════════════════════════
-- The postgres role (used by the SQL Editor) needs read access
-- to auth.users so our RLS helper functions can read user meta.
grant usage on schema auth to postgres;
grant select on table auth.users to postgres;

-- ════════════════════════════════════════════════════════════
-- SECTION 1: ENABLE REQUIRED EXTENSIONS
-- ════════════════════════════════════════════════════════════
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════
-- SECTION 2: HELPER FUNCTIONS (in public schema)
-- ════════════════════════════════════════════════════════════
-- NOTE: We create these in the PUBLIC schema (not auth schema)
-- because the SQL Editor's postgres role cannot create objects
-- in the auth schema. We use SECURITY DEFINER so the functions
-- execute with elevated privileges to read auth.users.

-- Get the current user's organisation_id from auth.users meta
-- This is the KEY function that powers all RLS policies.
create or replace function public.get_organisation_id()
returns uuid
language sql
stable
security definer
as $$
  select (raw_app_meta_data ->> 'organisation_id')::uuid
  from auth.users
  where id = auth.uid()
$$;

-- Get the current user's role from auth.users meta
create or replace function public.get_user_role()
returns text
language sql
stable
security definer
as $$
  select coalesce(raw_app_meta_data ->> 'role', 'staff')
  from auth.users
  where id = auth.uid()
$$;

-- Get current user's store_id
create or replace function public.get_user_store_id()
returns uuid
language sql
stable
security definer
as $$
  select (raw_app_meta_data ->> 'store_id')::uuid
  from auth.users
  where id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════
-- SECTION 3: CORE TABLES (Multi-Tenant Foundation)
-- ════════════════════════════════════════════════════════════

-- ── 3a. Organisations (Tenants) ──────────────────────────
create table public.organisations (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text not null unique,
  plan              text not null default 'trial'
                    check (plan in ('trial', 'starter', 'professional', 'enterprise')),
  is_active         boolean not null default true,
  trial_ends_at     timestamptz,
  current_period_end timestamptz,
  max_stores        int not null default 1,
  max_staff         int not null default 5,
  max_products      int not null default 200,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_organisations_slug on public.organisations (slug);
create index idx_organisations_active on public.organisations (is_active);

comment on table public.organisations is 'Each row = one tenant business (wine shop, bar, etc.)';


-- ── 3b. Users (linked to Supabase Auth) ──────────────────
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  name              text not null,
  pin               text unique,
  role              text not null default 'staff'
                    check (role in ('staff', 'manager', 'super_admin')),
  is_active         boolean not null default true,
  organisation_id   uuid not null references public.organisations(id) on delete restrict,
  store_id          uuid,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (email, organisation_id)
);

create index idx_users_organisation on public.users (organisation_id);
create index idx_users_pin on public.users (pin);
create index idx_users_role on public.users (role);
create index idx_users_store on public.users (store_id);

comment on table public.users is 'App-level user profile. id = auth.users.id. organisation_id set during registration.';


-- ── 3c. Stores / Branches ───────────────────────────────
create table public.stores (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  location          text not null default '',
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_stores_organisation on public.stores (organisation_id);

comment on table public.stores is 'Physical store/branch locations. Each tenant can have multiple stores.';


-- ════════════════════════════════════════════════════════════
-- SECTION 4: PRODUCT CATALOGUE
-- ════════════════════════════════════════════════════════════

-- ── 4a. Categories ──────────────────────────────────────
create table public.categories (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  colour            text not null default '#6B7280',
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  created_at        timestamptz not null default now(),

  unique (name, organisation_id)
);

create index idx_categories_organisation on public.categories (organisation_id);


-- ── 4b. Suppliers ───────────────────────────────────────
create table public.suppliers (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  contact_person    text not null default '',
  phone             text not null default '',
  email             text not null default '',
  product_types     text not null default '',
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_suppliers_organisation on public.suppliers (organisation_id);


-- ── 4c. Products (Inventory Items) ─────────────────────
create table public.products (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  sku               text not null default '',
  barcode           text not null default '',
  size              text not null default '750ml',
  opening_stock     int not null default 0,
  current_stock     int not null default 0,
  reorder_level     int not null default 5,
  cost_price        numeric(12,2) not null default 0,
  sell_price        numeric(12,2) not null default 0,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  category_id       uuid references public.categories(id) on delete set null,
  supplier_id       uuid references public.suppliers(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_products_organisation on public.products (organisation_id);
create index idx_products_store on public.products (store_id);
create index idx_products_barcode on public.products (barcode);
create index idx_products_sku on public.products (sku);
create index idx_products_category on public.products (category_id);
create index idx_products_supplier on public.products (supplier_id);

comment on table public.products is 'current_stock is NEVER manually edited. It is calculated: opening + purchases - sales - damaged - expired +/- adjustments.';


-- ════════════════════════════════════════════════════════════
-- SECTION 5: SALES & POS
-- ════════════════════════════════════════════════════════════

-- ── 5a. Sales ───────────────────────────────────────────
create table public.sales (
  id                uuid primary key default uuid_generate_v4(),
  total             numeric(12,2) not null,
  payment_method    text not null default 'cash'
                    check (payment_method in ('cash', 'card', 'mpesa')),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  staff_id          uuid not null references public.users(id) on delete restrict,
  created_at        timestamptz not null default now()
);

create index idx_sales_organisation on public.sales (organisation_id);
create index idx_sales_store on public.sales (store_id);
create index idx_sales_staff on public.sales (staff_id);
create index idx_sales_created on public.sales (created_at desc);


-- ── 5b. Sale Items ─────────────────────────────────────
create table public.sale_items (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  qty               int not null,
  price             numeric(12,2) not null,
  cost              numeric(12,2) not null,
  sale_id           uuid not null references public.sales(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict
);

create index idx_sale_items_sale on public.sale_items (sale_id);
create index idx_sale_items_product on public.sale_items (product_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 6: STOCK MANAGEMENT
-- ════════════════════════════════════════════════════════════

-- ── 6a. Stock Movements (immutable ledger) ─────────────
create table public.stock_movements (
  id                uuid primary key default uuid_generate_v4(),
  product_id        uuid not null references public.products(id) on delete restrict,
  store_id          uuid not null references public.stores(id) on delete cascade,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  movement_type     text not null
                    check (movement_type in (
                      'purchase',        -- Stock received from supplier
                      'sale',            -- Stock sold (deducted at POS)
                      'adjustment',      -- Manual correction
                      'damaged',         -- Damaged/broken stock
                      'expired',         -- Expired stock removed
                      'stock_take',      -- Stock count adjustment
                      'opening'          -- Initial opening stock
                    )),
  quantity          int not null,        -- positive = in, negative = out
  reference_id      uuid,               -- e.g. sale_id, purchase_id, stock_take_id
  notes             text not null default '',
  created_by        uuid not null references public.users(id) on delete restrict,
  created_at        timestamptz not null default now()
);

create index idx_stock_movements_product on public.stock_movements (product_id);
create index idx_stock_movements_store on public.stock_movements (store_id);
create index idx_stock_movements_org on public.stock_movements (organisation_id);
create index idx_stock_movements_type on public.stock_movements (movement_type);
create index idx_stock_movements_created on public.stock_movements (created_at desc);

comment on table public.stock_movements is 'Immutable stock ledger. Every stock change is recorded here. current_stock on products is a computed view over this table.';


-- ── 6b. Purchases / Stock Receiving ────────────────────
create table public.purchases (
  id                uuid primary key default uuid_generate_v4(),
  supplier_id       uuid references public.suppliers(id) on delete set null,
  store_id          uuid not null references public.stores(id) on delete cascade,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  total_cost        numeric(12,2) not null default 0,
  notes             text not null default '',
  received_by       uuid not null references public.users(id) on delete restrict,
  created_at        timestamptz not null default now(),

  -- JSON array of items received: [{productId, name, qty, costPrice}]
  items_data        jsonb not null default '[]'::jsonb
);

create index idx_purchases_organisation on public.purchases (organisation_id);
create index idx_purchases_store on public.purchases (store_id);
create index idx_purchases_supplier on public.purchases (supplier_id);


-- ── 6c. Stock Takes (Physical Counts) ──────────────────
create table public.stock_takes (
  id                uuid primary key default uuid_generate_v4(),
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'pending', 'approved', 'rejected')),
  started_by        uuid not null references public.users(id) on delete restrict,
  approved_by       uuid references public.users(id) on delete set null,
  approved_at       timestamptz,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  started_at        timestamptz not null default now(),
  submitted_at      timestamptz
);

create index idx_stock_takes_organisation on public.stock_takes (organisation_id);
create index idx_stock_takes_store on public.stock_takes (store_id);
create index idx_stock_takes_status on public.stock_takes (status);


-- ── 6d. Stock Take Items ───────────────────────────────
create table public.stock_take_items (
  id                uuid primary key default uuid_generate_v4(),
  expected          int not null,
  counted           int,
  stock_take_id     uuid not null references public.stock_takes(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict
);

create index idx_stock_take_items_take on public.stock_take_items (stock_take_id);
create index idx_stock_take_items_product on public.stock_take_items (product_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 7: DAILY RECONCILIATION
-- ════════════════════════════════════════════════════════════

create table public.reconciliations (
  id                uuid primary key default uuid_generate_v4(),
  date              text not null,       -- YYYY-MM-DD
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  recorded_by       uuid not null references public.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (date, store_id)
);

create index idx_recon_organisation on public.reconciliations (organisation_id);
create index idx_recon_store on public.reconciliations (store_id);


create table public.reconciliation_items (
  id                uuid primary key default uuid_generate_v4(),
  opening           int not null,
  sales_today       int not null default 0,
  stock_added       int not null default 0,
  expected_closing  int not null,
  actual_closing    int,
  reconciliation_id uuid not null references public.reconciliations(id) on delete cascade,
  product_id        uuid not null references public.products(id) on delete restrict
);

create index idx_recon_items_recon on public.reconciliation_items (reconciliation_id);
create index idx_recon_items_product on public.reconciliation_items (product_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 8: EXPENSES
-- ════════════════════════════════════════════════════════════

create table public.expenses (
  id                uuid primary key default uuid_generate_v4(),
  date              text not null,       -- YYYY-MM-DD
  category          text not null,       -- Rent, Utilities, Salaries, Inventory, Marketing, Maintenance, Other
  description       text not null,
  amount            numeric(12,2) not null,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  store_id          uuid not null references public.stores(id) on delete cascade,
  recorded_by       uuid not null references public.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_expenses_organisation on public.expenses (organisation_id);
create index idx_expenses_store on public.expenses (store_id);
create index idx_expenses_date on public.expenses (date);


-- ════════════════════════════════════════════════════════════
-- SECTION 9: AUDIT LOGS (Immutable)
-- ════════════════════════════════════════════════════════════

create table public.audit_logs (
  id                uuid primary key default uuid_generate_v4(),
  action            text not null,       -- e.g. "product.created", "sale.completed"
  entity            text not null,       -- e.g. "Product", "Sale", "User"
  entity_id         uuid,
  before_value      jsonb,               -- Snapshot before change
  after_value       jsonb,               -- Snapshot after change
  user_id           uuid not null references public.users(id) on delete restrict,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  ip_address        text not null default '',
  created_at        timestamptz not null default now()
);

create index idx_audit_organisation on public.audit_logs (organisation_id);
create index idx_audit_user on public.audit_logs (user_id);
create index idx_audit_action on public.audit_logs (action);
create index idx_audit_created on public.audit_logs (created_at desc);

comment on table public.audit_logs is 'Immutable audit trail. Records who did what, when, and what changed. Never update or delete rows.';


-- ════════════════════════════════════════════════════════════
-- SECTION 10: NOTIFICATIONS
-- ════════════════════════════════════════════════════════════

create table public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  message           text not null,
  type              text not null default 'info'
                    check (type in ('info', 'warning', 'error', 'success')),
  is_read           boolean not null default false,
  user_id           uuid not null references public.users(id) on delete cascade,
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id);
create index idx_notifications_organisation on public.notifications (organisation_id);
create index idx_notifications_read on public.notifications (is_read);


-- ════════════════════════════════════════════════════════════
-- SECTION 11: ORG SETTINGS (Key-Value)
-- ════════════════════════════════════════════════════════════

create table public.org_settings (
  id                uuid primary key default uuid_generate_v4(),
  key               text not null,
  value             text not null default '',
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (key, organisation_id)
);

create index idx_orgsettings_organisation on public.org_settings (organisation_id);


-- ════════════════════════════════════════════════════════════
-- SECTION 12: SUPER ADMIN ACCESS
-- ════════════════════════════════════════════════════════════

create table public.super_admin_access (
  id                uuid primary key default uuid_generate_v4(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  granted_by        uuid not null,       -- super_admin user id
  reason            text not null default '',
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_sa_access_org on public.super_admin_access (organisation_id);
create index idx_sa_access_expires on public.super_admin_access (expires_at);


-- ════════════════════════════════════════════════════════════
-- SECTION 13: ROW LEVEL SECURITY (CRITICAL!)
-- ════════════════════════════════════════════════════════════
-- Every table gets RLS. Policies ensure users can ONLY
-- see/modify data belonging to THEIR organisation.
-- All policies use public.get_organisation_id() and
-- public.get_user_role() (defined in Section 2).
-- ════════════════════════════════════════════════════════════

-- 13a. Organisations ──────────────────────────────────
alter table public.organisations enable row level security;

-- Anyone authenticated can read their own org
create policy "org_select_own" on public.organisations
  for select using (id = public.get_organisation_id());

-- Super admin can read all orgs
create policy "org_select_super_admin" on public.organisations
  for select using (public.get_user_role() = 'super_admin');

-- No insert/update/delete via RLS — use server-side functions


-- 13b. Users ───────────────────────────────────────────
alter table public.users enable row level security;

create policy "users_select_own_org" on public.users
  for select using (organisation_id = public.get_organisation_id());

create policy "users_update_own" on public.users
  for update using (id = auth.uid() or public.get_user_role() = 'manager')
  with check (organisation_id = public.get_organisation_id());

-- Managers can insert new staff
create policy "users_insert_manager" on public.users
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() = 'manager'
  );


-- 13c. Stores ─────────────────────────────────────────
alter table public.stores enable row level security;

create policy "stores_select_own_org" on public.stores
  for select using (organisation_id = public.get_organisation_id());

create policy "stores_insert_manager" on public.stores
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "stores_update_manager" on public.stores
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "stores_delete_manager" on public.stores
  for delete using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() = 'manager'
  );


-- 13d. Categories ─────────────────────────────────────
alter table public.categories enable row level security;

create policy "categories_select_own_org" on public.categories
  for select using (organisation_id = public.get_organisation_id());

create policy "categories_insert_manager" on public.categories
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "categories_update_manager" on public.categories
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "categories_delete_manager" on public.categories
  for delete using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13e. Suppliers ──────────────────────────────────────
alter table public.suppliers enable row level security;

create policy "suppliers_select_own_org" on public.suppliers
  for select using (organisation_id = public.get_organisation_id());

create policy "suppliers_insert_manager" on public.suppliers
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "suppliers_update_manager" on public.suppliers
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "suppliers_delete_manager" on public.suppliers
  for delete using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13f. Products ───────────────────────────────────────
alter table public.products enable row level security;

create policy "products_select_own_org" on public.products
  for select using (organisation_id = public.get_organisation_id());

create policy "products_insert_manager" on public.products
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "products_update_manager" on public.products
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "products_delete_manager" on public.products
  for delete using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13g. Sales ──────────────────────────────────────────
alter table public.sales enable row level security;

create policy "sales_select_own_org" on public.sales
  for select using (organisation_id = public.get_organisation_id());

create policy "sales_insert_own_org" on public.sales
  for insert with check (organisation_id = public.get_organisation_id());

-- No update or delete on sales (immutable)


-- 13h. Sale Items ─────────────────────────────────────
alter table public.sale_items enable row level security;

create policy "sale_items_select_own_org" on public.sale_items
  for select using (
    exists (
      select 1 from public.sales
      where sales.id = sale_items.sale_id
      and sales.organisation_id = public.get_organisation_id()
    )
  );

create policy "sale_items_insert_own_org" on public.sale_items
  for insert with check (
    exists (
      select 1 from public.sales
      where sales.id = sale_items.sale_id
      and sales.organisation_id = public.get_organisation_id()
    )
  );


-- 13i. Stock Movements ────────────────────────────────
alter table public.stock_movements enable row level security;

create policy "stock_movements_select_own_org" on public.stock_movements
  for select using (organisation_id = public.get_organisation_id());

-- Insert via server-side functions only (or manager)
create policy "stock_movements_insert_own_org" on public.stock_movements
  for insert with check (organisation_id = public.get_organisation_id());

-- NEVER update or delete stock movements (immutable ledger)


-- 13j. Purchases ──────────────────────────────────────
alter table public.purchases enable row level security;

create policy "purchases_select_own_org" on public.purchases
  for select using (organisation_id = public.get_organisation_id());

create policy "purchases_insert_manager" on public.purchases
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13k. Stock Takes ───────────────────────────────────
alter table public.stock_takes enable row level security;

create policy "stock_takes_select_own_org" on public.stock_takes
  for select using (organisation_id = public.get_organisation_id());

create policy "stock_takes_insert_own_org" on public.stock_takes
  for insert with check (organisation_id = public.get_organisation_id());

create policy "stock_takes_update_own_org" on public.stock_takes
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13l. Stock Take Items ──────────────────────────────
alter table public.stock_take_items enable row level security;

create policy "stock_take_items_select_own_org" on public.stock_take_items
  for select using (
    exists (
      select 1 from public.stock_takes
      where stock_takes.id = stock_take_items.stock_take_id
      and stock_takes.organisation_id = public.get_organisation_id()
    )
  );

create policy "stock_take_items_insert_own_org" on public.stock_take_items
  for insert with check (
    exists (
      select 1 from public.stock_takes
      where stock_takes.id = stock_take_items.stock_take_id
      and stock_takes.organisation_id = public.get_organisation_id()
    )
  );

create policy "stock_take_items_update_own_org" on public.stock_take_items
  for update using (
    exists (
      select 1 from public.stock_takes
      where stock_takes.id = stock_take_items.stock_take_id
      and stock_takes.organisation_id = public.get_organisation_id()
    )
  );


-- 13m. Reconciliations ───────────────────────────────
alter table public.reconciliations enable row level security;

create policy "recon_select_own_org" on public.reconciliations
  for select using (organisation_id = public.get_organisation_id());

create policy "recon_insert_own_org" on public.reconciliations
  for insert with check (organisation_id = public.get_organisation_id());

create policy "recon_update_own_org" on public.reconciliations
  for update using (organisation_id = public.get_organisation_id());


-- 13n. Reconciliation Items ──────────────────────────
alter table public.reconciliation_items enable row level security;

create policy "recon_items_select_own_org" on public.reconciliation_items
  for select using (
    exists (
      select 1 from public.reconciliations
      where reconciliations.id = reconciliation_items.reconciliation_id
      and reconciliations.organisation_id = public.get_organisation_id()
    )
  );

create policy "recon_items_insert_own_org" on public.reconciliation_items
  for insert with check (
    exists (
      select 1 from public.reconciliations
      where reconciliations.id = reconciliation_items.reconciliation_id
      and reconciliations.organisation_id = public.get_organisation_id()
    )
  );

create policy "recon_items_update_own_org" on public.reconciliation_items
  for update using (
    exists (
      select 1 from public.reconciliations
      where reconciliations.id = reconciliation_items.reconciliation_id
      and reconciliations.organisation_id = public.get_organisation_id()
    )
  );


-- 13o. Expenses ──────────────────────────────────────
alter table public.expenses enable row level security;

create policy "expenses_select_own_org" on public.expenses
  for select using (organisation_id = public.get_organisation_id());

create policy "expenses_insert_manager" on public.expenses
  for insert with check (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "expenses_update_manager" on public.expenses
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );

create policy "expenses_delete_manager" on public.expenses
  for delete using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13p. Audit Logs ────────────────────────────────────
alter table public.audit_logs enable row level security;

-- Users can read their org's audit logs
create policy "audit_select_own_org" on public.audit_logs
  for select using (organisation_id = public.get_organisation_id());

-- Insert is done by server-side trigger/function, not directly by users
create policy "audit_insert_service_role" on public.audit_logs
  for insert with check (true); -- Allow service_role to insert


-- 13q. Notifications ────────────────────────────────
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- 13r. Org Settings ─────────────────────────────────
alter table public.org_settings enable row level security;

create policy "settings_select_own_org" on public.org_settings
  for select using (organisation_id = public.get_organisation_id());

create policy "settings_update_manager" on public.org_settings
  for update using (
    organisation_id = public.get_organisation_id()
    and public.get_user_role() in ('manager', 'super_admin')
  );


-- 13s. Super Admin Access ───────────────────────────
alter table public.super_admin_access enable row level security;

create policy "sa_access_select_super" on public.super_admin_access
  for select using (public.get_user_role() = 'super_admin');

create policy "sa_access_insert_super" on public.super_admin_access
  for insert with check (public.get_user_role() = 'super_admin');

create policy "sa_access_update_super" on public.super_admin_access
  for update using (public.get_user_role() = 'super_admin');


-- ════════════════════════════════════════════════════════════
-- SECTION 14: SERVER-SIDE FUNCTIONS (Business Logic)
-- ════════════════════════════════════════════════════════════

-- ── 14a. Register: Create Org + User + First Store ───
create or replace function public.register_new_organisation(
  p_business_name text,
  p_manager_name  text,
  p_email         text,
  p_password_hash text,  -- Pre-hashed on client or via Supabase Auth
  p_pin           text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_org_id         uuid;
  v_store_id       uuid;
  v_user_id        uuid;
  v_slug           text;
  v_result         jsonb;
begin
  -- Generate unique slug
  v_slug := lower(regexp_replace(p_business_name, '[^a-z0-9]+', '-', 'g'));
  v_slug := v_slug || '-' || substr(encode(gen_random_bytes(3), 'hex'), 1, 6);
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');

  -- Create organisation
  insert into public.organisations (name, slug, trial_ends_at, current_period_end)
  values (p_business_name, v_slug, now() + interval '14 days', now() + interval '14 days')
  returning id into v_org_id;

  -- Create first store
  insert into public.stores (name, organisation_id)
  values ('Main Store', v_org_id)
  returning id into v_store_id;

  -- Create user profile row
  -- NOTE: The auth.users row is created separately via supabase.auth.signUp()
  -- or supabase.auth.admin.createUser() from your app backend.
  -- This function only creates the public.users profile.
  insert into public.users (email, name, pin, role, organisation_id, store_id)
  values (p_email, p_manager_name, p_pin, 'manager', v_org_id, v_store_id)
  returning id into v_user_id;

  -- Seed default categories
  insert into public.categories (name, colour, organisation_id) values
    ('Wine',      '#DC2626', v_org_id),
    ('Whisky',    '#92400E', v_org_id),
    ('Vodka',     '#3B82F6', v_org_id),
    ('Gin',       '#10B981', v_org_id),
    ('Rum',       '#F97316', v_org_id),
    ('Champagne', '#F59E0B', v_org_id),
    ('Beer',      '#FBBF24', v_org_id),
    ('Cognac',    '#78350F', v_org_id),
    ('Tequila',   '#059669', v_org_id),
    ('Liqueur',   '#8B5CF6', v_org_id),
    ('Brandy',    '#B91C1C', v_org_id),
    ('Other',     '#6B7280', v_org_id);

  -- Seed default suppliers
  insert into public.suppliers (name, contact_person, phone, email, product_types, organisation_id) values
    ('East African Wines Ltd', 'Peter Mwangi',   '+254 720 123 456', 'info@eawines.co.ke',     'Wine, Champagne',        v_org_id),
    ('Spirits Distributors KE','Jane Wanjiku',    '+254 733 456 789', 'orders@spiritsdist.co.ke','Whisky, Vodka, Gin, Rum', v_org_id),
    ('Premium Beverages',      'Samuel Ochieng',  '+254 711 789 012', 'sales@premiumbev.co.ke',  'Beer, Liqueur, Tequila',  v_org_id);

  v_result := jsonb_build_object(
    'organisation_id', v_org_id,
    'store_id', v_store_id,
    'user_id', v_user_id,
    'slug', v_slug
  );

  return v_result;
end;
$$;


-- ── 14b. Complete Sale (Atomic: create sale + deduct stock + log movement) ──
create or replace function public.complete_sale(
  p_store_id       uuid,
  p_staff_id       uuid,
  p_payment_method text,
  p_items          jsonb   -- [{productId, name, qty, price, cost}]
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sale_id    uuid;
  v_total      numeric;
  v_item       jsonb;
  v_product_id uuid;
  v_qty        int;
  v_org_id     uuid;
begin
  -- Get org_id from current user
  v_org_id := public.get_organisation_id();

  -- Calculate total
  v_total := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_total := v_total + (v_item ->> 'price')::numeric * (v_item ->> 'qty')::int;
  end loop;

  -- Create the sale
  insert into public.sales (total, payment_method, organisation_id, store_id, staff_id)
  values (
    v_total,
    p_payment_method,
    v_org_id,
    p_store_id,
    p_staff_id
  )
  returning id into v_sale_id;

  -- Create sale items + deduct stock + log movements
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'productId')::uuid;
    v_qty := (v_item ->> 'qty')::int;

    -- Insert sale item
    insert into public.sale_items (name, qty, price, cost, sale_id, product_id)
    values (
      v_item ->> 'name',
      v_qty,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'cost')::numeric,
      v_sale_id,
      v_product_id
    );

    -- Deduct stock
    update public.products
    set current_stock = current_stock - v_qty,
        updated_at = now()
    where id = v_product_id
      and organisation_id = v_org_id;

    -- Log stock movement (immutable)
    insert into public.stock_movements (product_id, store_id, organisation_id, movement_type, quantity, reference_id, notes, created_by)
    values (v_product_id, p_store_id, v_org_id, 'sale', -v_qty, v_sale_id, 'POS sale', p_staff_id);
  end loop;

  return v_sale_id;
end;
$$;


-- ── 14c. Receive Stock (Atomic: add stock + log movement) ──
create or replace function public.receive_stock(
  p_store_id     uuid,
  p_supplier_id  uuid,
  p_items        jsonb,  -- [{productId, qty, costPrice}]
  p_notes        text default '',
  p_received_by  uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_purchase_id  uuid;
  v_total_cost   numeric;
  v_item         jsonb;
  v_org_id       uuid;
begin
  v_org_id := public.get_organisation_id();
  v_total_cost := 0;

  -- Create purchase record
  insert into public.purchases (supplier_id, store_id, organisation_id, total_cost, notes, received_by, items_data)
  values (p_supplier_id, p_store_id, v_org_id, 0, p_notes, p_received_by, p_items)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- Add stock
    update public.products
    set current_stock = current_stock + (v_item ->> 'qty')::int,
        updated_at = now()
    where id = (v_item ->> 'productId')::uuid
      and organisation_id = v_org_id;

    -- Log movement
    insert into public.stock_movements (product_id, store_id, organisation_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'productId')::uuid,
      p_store_id,
      v_org_id,
      'purchase',
      (v_item ->> 'qty')::int,
      v_purchase_id,
      p_notes,
      p_received_by
    );

    v_total_cost := v_total_cost + ((v_item ->> 'qty')::int * (v_item ->> 'costPrice')::numeric);
  end loop;

  -- Update total cost
  update public.purchases set total_cost = v_total_cost where id = v_purchase_id;

  return v_purchase_id;
end;
$$;


-- ── 14d. Calculate Computed Stock (view over stock_movements) ──
create or replace view public.computed_stock as
select
  p.id as product_id,
  p.name,
  p.store_id,
  p.organisation_id,
  p.opening_stock,
  coalesce(
    p.opening_stock + sum(
      case
        when sm.movement_type in ('purchase', 'adjustment', 'stock_take', 'opening') then sm.quantity
        when sm.movement_type in ('sale', 'damaged', 'expired') then sm.quantity  -- already negative
        else 0
      end
    ),
    p.opening_stock
  ) as calculated_stock,
  p.current_stock as recorded_stock,
  p.current_stock - coalesce(
    p.opening_stock + sum(
      case
        when sm.movement_type in ('purchase', 'adjustment', 'stock_take', 'opening') then sm.quantity
        when sm.movement_type in ('sale', 'damaged', 'expired') then sm.quantity
        else 0
      end
    ), p.opening_stock
  ) as variance
from public.products p
left join public.stock_movements sm
  on sm.product_id = p.id
  and sm.store_id = p.store_id
group by p.id, p.name, p.store_id, p.organisation_id, p.opening_stock, p.current_stock;


-- ════════════════════════════════════════════════════════════
-- SECTION 15: UPDATED_AT AUTO-UPDATE TRIGGERS
-- ════════════════════════════════════════════════════════════

create or replace function public.trigger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organisations_updated
  before update on public.organisations
  for each row execute function public.trigger_updated_at();

create trigger trg_users_updated
  before update on public.users
  for each row execute function public.trigger_updated_at();

create trigger trg_stores_updated
  before update on public.stores
  for each row execute function public.trigger_updated_at();

create trigger trg_suppliers_updated
  before update on public.suppliers
  for each row execute function public.trigger_updated_at();

create trigger trg_products_updated
  before update on public.products
  for each row execute function public.trigger_updated_at();

create trigger trg_reconciliations_updated
  before update on public.reconciliations
  for each row execute function public.trigger_updated_at();

create trigger trg_expenses_updated
  before update on public.expenses
  for each row execute function public.trigger_updated_at();

create trigger trg_org_settings_updated
  before update on public.org_settings
  for each row execute function public.trigger_updated_at();


-- ════════════════════════════════════════════════════════════
-- SECTION 16: REALTIME SUBSCRIPTIONS (Optional)
-- ════════════════════════════════════════════════════════════
-- Enable Supabase Realtime for key tables so all staff
-- see live updates (new sales, stock changes, etc.)
-- NOTE: If you get a permission error here, you can enable
-- Realtime from the Supabase Dashboard instead:
-- Database → Replication → Select tables → Enable

do $$
begin
  alter publication supabase_realtime add table public.sales;
  alter publication supabase_realtime add table public.products;
  alter publication supabase_realtime add table public.stock_takes;
  alter publication supabase_realtime add table public.notifications;
exception when others then
  raise notice 'Realtime setup skipped: %. Enable manually from Dashboard → Database → Replication.', SQLERRM;
end $$;


-- ════════════════════════════════════════════════════════════
-- DONE! Schema is complete.
-- ════════════════════════════════════════════════════════════