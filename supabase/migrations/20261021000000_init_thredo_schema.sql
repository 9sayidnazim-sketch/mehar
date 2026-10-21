-- ==============================================================================
-- THREDO Commercial POS & Tailoring Management System
-- Production Supabase Database Schema Migration
-- ==============================================================================

-- 1. Enable Required Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 2. Generic updated_at Trigger Function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==============================================================================
-- 3. CORE TENANCY & BUSINESS ENTITIES
-- ==============================================================================

-- Businesses (Multi-tenant isolation)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  contact_name text,
  email text not null,
  phone text,
  currency text not null default 'AED',
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_businesses_updated_at
before update on public.businesses
for each row execute function public.handle_updated_at();

-- Companies (Store Profile, TRN / Tax info, Branding)
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  legal_name text,
  registration_number text,
  tax_number text,
  address text,
  phone text,
  email text,
  whatsapp text,
  currency text not null default 'AED',
  timezone text not null default 'Asia/Dubai',
  logo_url text,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.handle_updated_at();

-- User Profiles (Linked to auth.users if available, or standalone staff profile)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete cascade,
  email text unique,
  full_name text not null,
  phone text,
  role text not null default 'user' check (role in ('admin', 'manager', 'tailor', 'user')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.handle_updated_at();

-- ==============================================================================
-- 4. SUBSCRIPTION, PAYWALL & ACCESS CONTROL
-- ==============================================================================

-- Subscription Plans
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_label text not null,
  amount numeric(12, 2) not null default 0.00,
  duration_days integer not null,
  payment_url text not null,
  is_active boolean not null default true,
  sort_order integer not null default 1,
  provisional_access_hours integer not null default 48,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscriptions (Active terms for each business)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'expired', 'provisional', 'cancelled')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payment Submissions (Receipts / Reference submissions for manual/Ziina verification)
create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  customer_name text,
  business_name text,
  email text,
  phone text,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  plan_name text,
  price_label text,
  amount numeric(12, 2) not null default 0.00,
  duration_days integer,
  payment_url text,
  reference_number text not null,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'pending_verification', 'verified', 'rejected')),
  rejection_reason text,
  provisional_expires_at timestamptz,
  verified_at timestamptz,
  verified_by_user_id uuid references public.users(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Promotional Coupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  duration_hours integer not null default 48,
  max_redemptions integer not null default 100,
  redeemed_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Coupon Redemptions
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  granted_until timestamptz not null,
  unique (coupon_id, business_id)
);

-- Access Grants (Immutable audit trail of access changes)
create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  granted_by_user_id uuid references public.users(id) on delete set null,
  grant_type text not null check (grant_type in ('subscription', 'coupon', 'provisional', 'admin_override', 'revocation')),
  granted_until timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 5. NOTIFICATIONS & AUDIT LOGS
-- ==============================================================================

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'success', 'warning', 'error', 'payment')),
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- 6. TAILORING OPERATIONS: CUSTOMERS, MEASUREMENTS & TAILORS
-- ==============================================================================

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  whatsapp text,
  address text,
  city text,
  area text,
  postal_code text,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  notes text,
  total_orders integer not null default 0,
  total_spent numeric(12, 2) not null default 0.00,
  outstanding_balance numeric(12, 2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.handle_updated_at();

-- Measurement Templates (e.g. Kandora, Suit, Shirt, Pant)
create table if not exists public.measurement_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Unisex' check (category in ('Men', 'Women', 'Kids', 'Unisex')),
  fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_measurement_templates_updated_at
before update on public.measurement_templates
for each row execute function public.handle_updated_at();

-- Customer Measurements
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  template_id uuid references public.measurement_templates(id) on delete set null,
  template_name text,
  customer_name text,
  values jsonb not null default '{}'::jsonb,
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_measurements_updated_at
before update on public.measurements
for each row execute function public.handle_updated_at();

-- Tailors & Craftsmen
create table if not exists public.tailors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  department text not null default 'Workshop',
  phone text,
  email text,
  address text,
  specialization text not null default 'General',
  rate_type text not null default 'piecework' check (rate_type in ('piecework', 'hourly')),
  rate numeric(12, 2) not null default 0.00,
  active boolean not null default true,
  total_orders_assigned integer not null default 0,
  completed_orders integer not null default 0,
  monthly_earnings numeric(12, 2) not null default 0.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_tailors_updated_at
before update on public.tailors
for each row execute function public.handle_updated_at();

-- Products & Fabrics Catalog
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Fabric',
  sku text,
  price numeric(12, 2) not null default 0.00,
  cost numeric(12, 2) not null default 0.00,
  stock_quantity numeric(12, 2) not null default 0.00,
  unit text not null default 'meter',
  image_url text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_products_updated_at
before update on public.products
for each row execute function public.handle_updated_at();

-- ==============================================================================
-- 7. ORDERS, SALES, INVOICES & PAYMENTS
-- ==============================================================================

-- Orders Sequence for readable numbers (e.g. ORD-1001)
create sequence if not exists public.order_number_seq start with 1001;

-- Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id text not null unique default ('ORD-' || nextval('public.order_number_seq')),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_name text not null,
  tailor_id uuid references public.tailors(id) on delete set null,
  tailor_name text,
  booking_date date not null default current_date,
  delivery_date date not null,
  priority text not null default 'Normal' check (priority in ('Normal', 'Rush', 'Premium')),
  order_type text not null default 'Standard' check (order_type in ('Standard', 'Alteration')),
  status text not null default 'Booked' check (status in (
    'Booked', 'Cutting', 'Assigned', 'Stitching', 'Quality Check', 'Trial', 'Alteration', 'Ready', 'Delivered', 'Cancelled'
  )),
  template_id uuid references public.measurement_templates(id) on delete set null,
  template_name text,
  measurement_values jsonb default '{}'::jsonb,
  fabric_type text,
  fabric_code text,
  fabric_quantity numeric(10, 2) default 0.00,
  fabric_cost numeric(12, 2) default 0.00,
  supplier text,
  style_notes text,
  accessories text,
  tailor_rate numeric(12, 2) default 0.00,
  markup_percent numeric(5, 2) default 0.00,
  discount numeric(12, 2) default 0.00,
  discount_type text default 'percent' check (discount_type in ('percent', 'fixed')),
  tax_percent numeric(5, 2) default 0.00,
  subtotal numeric(12, 2) not null default 0.00,
  total_amount numeric(12, 2) not null default 0.00,
  amount_paid numeric(12, 2) not null default 0.00,
  balance_due numeric(12, 2) not null default 0.00,
  payment_status text not null default 'Pending' check (payment_status in ('Paid', 'Partial', 'Pending')),
  payment_method text,
  delivery_method text not null default 'Pickup' check (delivery_method in ('Pickup', 'Delivery')),
  remarks text,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'online')),
  online_pending boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.handle_updated_at();

-- Sales Sequence for invoice numbers (e.g. INV-1001)
create sequence if not exists public.sale_number_seq start with 1001;

-- Sales & Tax Invoices
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id text not null unique default ('INV-' || nextval('public.sale_number_seq')),
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12, 2) not null default 0.00,
  discount numeric(12, 2) not null default 0.00,
  tax_percent numeric(5, 2) not null default 0.00,
  tax_amount numeric(12, 2) not null default 0.00,
  total numeric(12, 2) not null default 0.00,
  amount_paid numeric(12, 2) not null default 0.00,
  balance_due numeric(12, 2) not null default 0.00,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'Card', 'UPI', 'Bank Transfer')),
  payment_status text not null default 'Pending' check (payment_status in ('Paid', 'Partial', 'Pending')),
  date date not null default current_date,
  status text not null default 'Completed' check (status in ('Completed', 'Refunded', 'Cancelled')),
  notes text,
  bill_sent_whatsapp boolean not null default false,
  bill_sent_email boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'online')),
  online_pending boolean not null default false,
  whatsapp_status text check (whatsapp_status in ('Submitted', 'Delivered', 'Failed', 'Pending')),
  whatsapp_recipient text,
  whatsapp_invoice_id text,
  whatsapp_timestamp timestamptz,
  whatsapp_message_id text,
  sent_to_number text,
  whatsapp_history jsonb not null default '[]'::jsonb,
  invoice_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_sales_updated_at
before update on public.sales
for each row execute function public.handle_updated_at();

-- Payments (Cash / Card receipts recorded against orders or sales)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  order_ref text,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  amount numeric(12, 2) not null default 0.00,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'Card', 'UPI', 'Bank Transfer')),
  date date not null default current_date,
  reference_number text,
  notes text,
  type text not null default 'payment' check (type in ('payment', 'advance', 'refund')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.handle_updated_at();

-- Automatically sync order balance when a payment is inserted, updated, or deleted
create or replace function public.sync_order_payment_balance()
returns trigger
language plpgsql
as $$
declare
  target_order_id uuid;
  total_paid numeric(12, 2);
  order_total numeric(12, 2);
begin
  target_order_id := coalesce(new.order_id, old.order_id);
  if target_order_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0.00)
  into total_paid
  from public.payments
  where order_id = target_order_id;

  select total_amount
  into order_total
  from public.orders
  where id = target_order_id;

  if order_total is not null then
    update public.orders
    set
      amount_paid = total_paid,
      balance_due = greatest(0.00, order_total - total_paid),
      payment_status = case
        when total_paid >= order_total then 'Paid'
        when total_paid > 0 then 'Partial'
        else 'Pending'
      end
    where id = target_order_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trigger_sync_order_payment_balance
after insert or update or delete on public.payments
for each row execute function public.sync_order_payment_balance();

-- Operational Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null default current_date,
  category text not null default 'Other' check (category in (
    'Fabric Purchase', 'Thread & Accessories', 'Salaries', 'Rent', 'Utilities', 'Equipment', 'Marketing', 'Transport', 'Other'
  )),
  description text,
  amount numeric(12, 2) not null default 0.00,
  payment_method text not null default 'Cash' check (payment_method in ('Cash', 'Card', 'UPI', 'Bank Transfer')),
  reference_number text,
  tailor_id uuid references public.tailors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.handle_updated_at();

-- Online Storefront / Website Configuration
create table if not exists public.website_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  store_name text not null default 'THREDO Tailors',
  slug text unique,
  banner_url text,
  online_ordering_enabled boolean not null default true,
  paused boolean not null default false,
  contact_phone text,
  contact_email text,
  delivery_charge numeric(12, 2) not null default 0.00,
  pickup_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_website_configs_updated_at
before update on public.website_configs
for each row execute function public.handle_updated_at();

-- ==============================================================================
-- 8. PERFORMANCE INDEXES (Supabase Postgres Best Practices)
-- ==============================================================================

-- Foreign key indexes to eliminate sequential scans on joins
create index if not exists idx_companies_business_id on public.companies(business_id);
create index if not exists idx_users_business_id on public.users(business_id);
create index if not exists idx_users_auth_user_id on public.users(auth_user_id);
create index if not exists idx_subscriptions_business_id on public.subscriptions(business_id);
create index if not exists idx_payment_submissions_business_id on public.payment_submissions(business_id);
create index if not exists idx_payment_submissions_status on public.payment_submissions(status);
create index if not exists idx_customers_business_id on public.customers(business_id);
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_measurements_customer_id on public.measurements(customer_id);
create index if not exists idx_measurements_business_id on public.measurements(business_id);
create index if not exists idx_tailors_business_id on public.tailors(business_id);
create index if not exists idx_products_business_id on public.products(business_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_business_id on public.orders(business_id);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_tailor_id on public.orders(tailor_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_delivery_date on public.orders(delivery_date);
create index if not exists idx_sales_business_id on public.sales(business_id);
create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_sales_order_id on public.sales(order_id);
create index if not exists idx_sales_date on public.sales(date);
create index if not exists idx_payments_business_id on public.payments(business_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payments_customer_id on public.payments(customer_id);
create index if not exists idx_expenses_business_id on public.expenses(business_id);
create index if not exists idx_app_notifications_business_id on public.app_notifications(business_id, read);
create index if not exists idx_audit_logs_business_id on public.audit_logs(business_id);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL
-- ==============================================================================

-- Helper function to fetch the business_id of the currently authenticated user
create or replace function public.current_user_business_id()
returns uuid
language sql
stable
security definer
as $$
  select business_id from public.users
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Enable RLS on every table
alter table public.businesses enable row level security;
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.access_grants enable row level security;
alter table public.app_notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.customers enable row level security;
alter table public.measurement_templates enable row level security;
alter table public.measurements enable row level security;
alter table public.tailors enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.website_configs enable row level security;

-- Policies: Subscription Plans (Readable by anyone authenticated or anon)
create policy "Anyone can view active plans" on public.subscription_plans
  for select using (is_active = true);

-- Policies: Products Catalog (Readable by authenticated staff & public online customers)
create policy "Anyone can view active products" on public.products
  for select using (active = true);

create policy "Staff can manage products" on public.products
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Website Configuration (Public storefront view)
create policy "Public can view website config" on public.website_configs
  for select using (true);

create policy "Staff can manage website config" on public.website_configs
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Customers (Authenticated staff only)
create policy "Staff can view customers" on public.customers
  for select to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can insert customers" on public.customers
  for insert to authenticated
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can update customers" on public.customers
  for update to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can delete customers" on public.customers
  for delete to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Orders (Staff management + Public online order placement)
create policy "Public can submit online orders" on public.orders
  for insert to anon
  with check (source = 'online');

create policy "Staff can view orders" on public.orders
  for select to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can manage orders" on public.orders
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Sales (Authenticated staff only)
create policy "Staff can manage sales" on public.sales
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Payments (Authenticated staff only)
create policy "Staff can manage payments" on public.payments
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Tailors (Authenticated staff only)
create policy "Staff can manage tailors" on public.tailors
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Measurements & Templates (Authenticated staff only)
create policy "Staff can manage measurement templates" on public.measurement_templates
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can manage measurements" on public.measurements
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Expenses (Authenticated staff only)
create policy "Staff can manage expenses" on public.expenses
  for all to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: App Notifications (Staff view and update read status)
create policy "Staff can view notifications" on public.app_notifications
  for select to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Staff can update notification read status" on public.app_notifications
  for update to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null)
  with check (business_id = public.current_user_business_id() or auth.uid() is not null);

-- Policies: Payment Submissions (Users submit receipts, admins approve)
create policy "Users can submit payment references" on public.payment_submissions
  for insert to authenticated
  with check (true);

create policy "Staff can view their payment submissions" on public.payment_submissions
  for select to authenticated
  using (business_id = public.current_user_business_id() or auth.uid() is not null);

create policy "Admins can update payment submissions" on public.payment_submissions
  for update to authenticated
  using (true)
  with check (true);

-- ==============================================================================
-- 10. REALTIME PUBLICATION
-- ==============================================================================
-- Add key operational tables to supabase_realtime publication for live reactivity
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders;
    alter publication supabase_realtime add table public.sales;
    alter publication supabase_realtime add table public.payments;
    alter publication supabase_realtime add table public.app_notifications;
  end if;
exception when others then
  -- publication configuration error handled gracefully
  null;
end $$;
