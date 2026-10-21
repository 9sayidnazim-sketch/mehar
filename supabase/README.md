# THREDO Supabase Database Guide

This directory contains the production-grade PostgreSQL database schema, seed data, and configuration for **THREDO (Mehar Tailors)** built for **Supabase**.

---

## 1. Quick Setup in Supabase Dashboard (Recommended)

1. Open your project on [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab on the left sidebar.
3. Click **New Query**.
4. Copy the entire contents of [`supabase/migrations/20261021000000_init_thredo_schema.sql`](./migrations/20261021000000_init_thredo_schema.sql) and paste it into the editor.
5. Click **Run** (or `Cmd + Enter`).
6. Next, open another new query, copy the contents of [`supabase/seed.sql`](./seed.sql), and click **Run**.
7. Your tables, indexes, triggers, RLS policies, and initial records are now live!

---

## 2. Setup via Supabase CLI (Local or Linked Project)

If using the Supabase CLI:

```bash
# Link your remote Supabase project
npx supabase link --project-ref <your-project-ref>

# Push the migration to remote
npx supabase db push

# (Optional) Apply seed data
npx supabase db query < supabase/seed.sql
```

---

## 3. Connecting the Frontend Application

Add your Supabase credentials to your `.env.local` file (and Vercel Environment Variables):

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sbp_... (or your anon public key)
```

The application client at [`src/lib/supabaseClient.js`](../src/lib/supabaseClient.js) and [`src/api/supabaseAdapter.js`](../src/api/supabaseAdapter.js) will automatically detect these credentials and route database reads/writes to Supabase, falling back to local seed data if credentials are not provided.

---

## 4. Database Architecture & Schema Summary

### Tables
| Table | Purpose | RLS Status |
| :--- | :--- | :--- |
| `businesses` | Multi-tenant company/tenant isolation | Enabled |
| `companies` | Store profiles, legal names, TRN / Tax numbers, and addresses | Enabled |
| `users` | Staff profiles with roles (`admin`, `manager`, `tailor`, `user`) | Enabled |
| `customers` | Client directory, contact details, balance, and order history | Enabled |
| `measurement_templates` | Tailoring pattern specifications (Kandora, Suit, Shirt, etc.) | Enabled |
| `measurements` | Individual customer measurement records | Enabled |
| `tailors` | Workshop craftsmen, specialization, and piecework/hourly rates | Enabled |
| `products` | Fabrics catalog, accessories, stock quantities, and prices | Enabled |
| `orders` | Garment orders with statuses (`Booked`, `Cutting`, `Stitching`, `Ready`, `Delivered`) | Enabled |
| `sales` | Tax invoices, subtotals, VAT, discounts, and WhatsApp status | Enabled |
| `payments` | Customer order receipts with automatic balance sync triggers | Enabled |
| `expenses` | Workshop operating costs and materials purchases | Enabled |
| `subscription_plans` | Commercial plans (`Yearly Pro`, `Lifetime Perpetual`) | Enabled |
| `subscriptions` | Active subscription terms for businesses | Enabled |
| `payment_submissions` | PayNow references awaiting admin verification | Enabled |
| `coupons` | 48-hour promotional coupon passes | Enabled |
| `coupon_redemptions` | Single-use coupon tracking per business | Enabled |
| `app_notifications` | In-app alerts and notifications | Enabled |
| `audit_logs` | Immutable admin action records | Enabled |
| `website_configs` | Online storefront ordering settings | Enabled |

### Performance & Security Best Practices Implemented
- **Row-Level Security (RLS)**: Enforced across 100% of tables with tenant isolation policies.
- **Indexes**: Added B-tree indexes for all foreign keys (`customer_id`, `order_id`, `business_id`, etc.) and filter columns (`status`, `delivery_date`, `date`) to avoid table scans.
- **Auto-Sync Triggers**:
  - `handle_updated_at`: Automatically sets `updated_at = now()` on row modifications.
  - `sync_order_payment_balance`: Automatically recalculates order `amount_paid`, `balance_due`, and updates `payment_status` (`Paid`, `Partial`, `Pending`) whenever a payment is added or updated.
- **Sequences**: Dedicated `order_number_seq` and `sale_number_seq` for friendly invoice identifiers (`ORD-1001`, `INV-1001`).
- **Realtime**: Added `orders`, `sales`, `payments`, and `app_notifications` to `supabase_realtime` publication for instant cross-device updates.
