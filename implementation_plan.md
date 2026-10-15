# Implementation Plan: THREDO Single-Link Access System

## Executive Overview
This implementation transforms THREDO from an open, localStorage-mocked demonstration app into a secure, single-link commercial POS and tailoring management suite. It enforces real server-side authentication, a strict paywall, verified payments with provisional access, 48-hour promotional coupons, a protected admin console (`/admin`), live in-app notifications, and hardened WhatsApp dispatch with zero leaked credentials.

---

## 1. Stack & Platform Verification (Base44 Capabilities)

### Verified Supported Capabilities
1. **SDK & Client (`@base44/sdk@0.8.53`):**
   - Full authentication API: `auth.register`, `auth.verifyOtp`, `auth.resendOtp`, `auth.loginViaEmailPassword`, `auth.loginWithProvider('google')`, `auth.logout()`, `auth.me()`, `auth.isAuthenticated()`, `auth.hasToken()`, `auth.setToken()`.
   - Entity CRUD & querying: `entities.<Entity>.list(sort, limit)`, `filter(query, sort, limit)`, `get(id)`, `create(data)`, `update(id, data)`, `delete(id)`.
   - Backend function execution: `functions.invoke(name, payload)` with request-context client creation `createClientFromRequest(req)` and service role execution `asServiceRole`.
2. **Backend Serverless Functions (`base44/functions/<name>/entry.ts`):**
   - Deno / TypeScript runtime handling `(req: Request): Promise<Response>`.
   - Access to platform runtime secrets via `import { secrets } from 'base44:runtime'` (`secrets.get('KEY')`).
   - Privileged operations bypassing client permissions using `asServiceRole`.
3. **Database Entities (`base44/entities/<Entity>.jsonc`):**
   - JSON-Schema backed entity models with strong field typing, default values, and enum validation.

---

## 2. Data Model & Architecture

### New Entities to Create in `base44/entities/`

1. **`Business.jsonc`**
   - `id`: string (UUID)
   - `name`: string (e.g. "Mehar Tailors LLC")
   - `slug`: string (unique)
   - `contact_name`: string
   - `email`: string
   - `phone`: string (E.164, e.g. `+971501234567`)
   - `status`: enum (`active`, `suspended`, `pending`)
   - `created_date`: ISO date string

2. **`SubscriptionPlan.jsonc`**
   - `id`: string
   - `name`: string (e.g., "Yearly Pro", "Lifetime Perpetual")
   - `price_label`: string (e.g., "AED 2,222/yr", "AED 3,200 one-time")
   - `duration_days`: number (e.g. 365, or 36500 for lifetime)
   - `payment_url`: string (secure checkout link)
   - `is_active`: boolean
   - `sort_order`: number
   - `provisional_access_hours`: number (default: 48)

3. **`Subscription.jsonc`**
   - `id`: string
   - `business_id`: string (indexed)
   - `plan_id`: string
   - `status`: enum (`active`, `expired`, `cancelled`)
   - `start_date`: ISO date string
   - `expires_at`: ISO date string (UTC)
   - `payment_submission_id`: string
   - `created_date`: ISO date string

4. **`PaymentSubmission.jsonc`** *(Replaces client mock; distinct from customer order `Payment`)*
   - `id`: string
   - `business_id`: string (indexed)
   - `user_id`: string
   - `plan_id`: string
   - `plan_name`: string
   - `price_label`: string
   - `duration_days`: number
   - `payment_url`: string
   - `reference_number`: string (6-64 chars: `^[A-Za-z0-9_-]{6,64}$`, unique globally)
   - `status`: enum (`awaiting_payment`, `pending_verification`, `verified`, `rejected`)
   - `rejection_reason`: string (nullable)
   - `provisional_expires_at`: ISO date string (UTC)
   - `verified_at`: ISO date string (UTC, nullable)
   - `verified_by_user_id`: string (nullable)
   - `idempotency_key`: string (unique)
   - `created_date`: ISO date string

5. **`Coupon.jsonc`**
   - `id`: string
   - `code`: string (uppercase, 4-32 chars: `^[A-Z0-9-]{4,32}$`, unique)
   - `duration_hours`: number (default: 48)
   - `max_redemptions`: number (default: 1)
   - `redemption_count`: number (default: 0)
   - `valid_until`: ISO date string (nullable)
   - `is_active`: boolean
   - `created_by_user_id`: string
   - `created_date`: ISO date string

6. **`CouponRedemption.jsonc`**
   - `id`: string
   - `coupon_id`: string
   - `business_id`: string (unique composite index on `coupon_id` + `business_id`)
   - `user_id`: string
   - `redeemed_at`: ISO date string (UTC)
   - `expires_at`: ISO date string (UTC)

7. **`AccessGrant.jsonc`**
   - `id`: string
   - `business_id`: string (indexed)
   - `type`: enum (`subscription`, `coupon`, `provisional`, `admin_override`)
   - `source_id`: string
   - `starts_at`: ISO date string (UTC)
   - `expires_at`: ISO date string (UTC)
   - `status`: enum (`active`, `expired`, `revoked`)
   - `notes`: string
   - `created_date`: ISO date string

8. **`AppNotification.jsonc`**
   - `id`: string
   - `business_id`: string (indexed)
   - `user_id`: string (nullable)
   - `type`: enum (`payment_submitted`, `subscription_active`, `payment_rejected`, `coupon_applied`, `expiring_72h`, `expiring_24h`, `access_ended`, `access_revoked`)
   - `title`: string
   - `message`: string
   - `dedupe_key`: string (unique)
   - `link`: string (e.g., `/paywall`, `/settings`)
   - `is_read`: boolean
   - `created_date`: ISO date string

9. **`AuditLog.jsonc`**
   - `id`: string
   - `user_id`: string
   - `user_email`: string
   - `action`: string (e.g., `approve_payment`, `reject_payment`, `grant_access`, `revoke_access`)
   - `entity_name`: string
   - `entity_id`: string
   - `details`: object / string
   - `created_date`: ISO date string

### Updating Existing Business Entities
Every business data entity (`Customer`, `Order`, `Sale`, `Payment`, `Expense`, `Tailor`, `MeasurementTemplate`, `Company`, `WebsiteConfig`) will include:
- `business_id`: string (indexed, mandatory for all queries to ensure strict multi-tenant isolation)

---

## 3. Server Functions Specifications

All server-side checks and workflows will run through Base44 backend functions located in `base44/functions/`:

1. **`getAccessState/entry.ts`**
   - Validates authenticated user via `createClientFromRequest(req)`.
   - Computes UTC timestamp (`new Date().toISOString()`).
   - Priority Hierarchy:
     1. **`admin`**: User role is `'admin'` -> Returns `{ state: 'admin', badge: 'Admin', role: 'admin' }`.
     2. **`subscription`**: Active `Subscription` record with `expires_at > now` -> Returns `{ state: 'subscription', expires_at, badge: 'Active until <formatted Asia/Dubai date>', renewal_under_verification: boolean }`.
     3. **`coupon`**: Active `CouponRedemption` with `expires_at > now` -> Returns `{ state: 'coupon', expires_at, badge: 'Coupon access until <formatted Asia/Dubai date>' }`.
     4. **`provisional`**: `PaymentSubmission` with status `'pending_verification'` and `now < provisional_expires_at` -> Returns `{ state: 'provisional', expires_at: provisional_expires_at, badge: 'Under Verification' }`.
     5. **`none` / `expired` / `rejected` / `revoked` / `provisional_expired`**: Returns `{ state, reason, allowed: false }`.
   - All dates formatted in Dubai Time (`Asia/Dubai`, UTC+4) for user display while evaluated strictly against UTC server time.

2. **`initiatePayment/entry.ts`**
   - Input: `{ plan_id, full_name, business_name, email, phone }`.
   - Server validates name, email, and normalizes phone number to E.164 (`+9715...`).
   - Retrieves active plan from `SubscriptionPlan`. If plan has no `payment_url` or `duration_days`, returns 400.
   - Generates idempotency key and creates `PaymentSubmission` in `awaiting_payment` status.
   - Returns `{ submission_id, redirect_url: plan.payment_url }`.

3. **`submitPaymentReference/entry.ts`**
   - Input: `{ submission_id, reference_number }`.
   - Validates reference format: `^[A-Za-z0-9_-]{6,64}$`.
   - Enforces global and tenant uniqueness (rejects duplicate references).
   - Updates status to `pending_verification`, sets `provisional_expires_at = now + 48 hours`.
   - Creates `payment_submitted` notification for user and admin queue.

4. **`redeemCoupon/entry.ts`**
   - Rate limit: Enforces maximum 5 failed attempts per user per 15 minutes.
   - Refusal checks:
     - User/business already has active access (subscription, coupon, provisional) -> Refuse (D8).
     - Coupon does not exist or `is_active === false` -> Refuse with specific message.
     - `valid_until` is set and `now > valid_until` -> Refuse ("Coupon has expired").
     - `redemption_count >= max_redemptions` -> Refuse ("Coupon is fully redeemed").
     - `CouponRedemption` already exists for this `coupon_id` + `business_id` -> Refuse ("Already redeemed by your business").
   - Atomic database write:
     - Increments `redemption_count`.
     - Inserts `CouponRedemption` with `expires_at = now + duration_hours`.
     - Creates `AccessGrant`.
     - Emits `coupon_applied` notification.

5. **`adminApprovePayment/entry.ts`**
   - Server-enforced: requires `user.role === 'admin'`. Non-admins receive 404.
   - Atomic check: only allows update if `PaymentSubmission.status === 'pending_verification'`.
   - Implements D7 Renewal Logic:
     - If business has an active subscription, new expiry = `existing.expires_at + duration_days`.
     - Otherwise, new expiry = `now + duration_days`.
   - Creates/updates `Subscription`, sets submission status to `verified`.
   - Logs action to `AuditLog`.
   - Emits `subscription_active` notification.

6. **`adminRejectPayment/entry.ts`**
   - Server-enforced: requires `user.role === 'admin'`. Non-admins receive 404.
   - Requires non-empty `rejection_reason`.
   - Updates status to `rejected`, revokes any ongoing provisional access.
   - Logs action to `AuditLog`.
   - Emits `payment_rejected` notification.

7. **`sendWhatsAppInvoiceServer/entry.ts`**
   - Removes dev-only `/api/gateway` Vite proxy dependency.
   - Reads `GATEWAY_API_KEY` and `GATEWAY_URL` (or Meta Cloud API token) strictly from `base44:runtime` secrets.
   - Generates PDF invoice server-side and sends message to destination number.
   - Only marks `bill_sent_whatsapp: true` if gateway responds with HTTP 200 and success confirmation.

8. **`submitOnlineOrder/entry.ts`**
   - Enforces D4: checks target business access state before accepting orders.
   - If business access is expired or paused, returns 403 with `paused: true`.
   - If active, creates `Order` or `Sale` with unique order reference and returns confirmation.

---

## 4. UI / Screen Architecture & User Flows

### 1. Unified Authentication Flow (`/login`, `/register`)
- Clean email/password + OTP verification screens using `@base44/sdk` auth methods.
- Google OAuth provider login via `db.auth.loginWithProvider('google')`.
- Proper server-backed logout ending session and clearing tokens.

### 2. Access Guard & Route Protection
- Wraps all protected routes in `App.jsx`.
- If unauthenticated -> redirects to `/login`.
- If authenticated -> calls server `getAccessState()`.
- If access is current -> renders protected application.
- If access is not active -> redirects directly to `/paywall` with tailored state message (e.g. "Provisional access expired", "Your subscription ended on...", "Payment reference rejected").
- Zero protected data rendered or requested if access is not active.

### 3. Paywall Page (`/paywall`)
- Dynamic presentation of 2 active plans from `SubscriptionPlan`.
- Contact & business details form with client + server validation.
- "PayNow" trigger redirecting to plan checkout URL in the same tab.
- "Enter your payment reference" modal/input after return from payment gateway.
- 48-Hour Coupon Pass redemption form with instant feedback.
- Secure, responsive layout with 44px+ tap targets.

### 4. Live Notifications Bell & Popover (Top Right Header)
- Replaces static bell with interactive popover.
- Badge displaying count of unread notifications.
- List of notifications ordered newest first with relative time display.
- "Mark all as read" button.
- Deep links to `/paywall` or `/settings`.
- Auto-refresh on window focus and every 60s.

### 5. Admin Console (`/admin`)
- Server-gated: non-admin requests receive HTTP 404 from backend.
- **Payments Queue**: Oldest pending submissions first, highlighting submissions older than 24h, Approve/Reject modals with mandatory reason input.
- **Businesses Directory**: Displays access state, expiry, manual extend/grant dialog, revoke button with confirmation.
- **Coupons Management**: Coupon generator (code, duration_hours, max_redemptions), active toggle, and list of redemptions.
- **Plans Configuration**: Edit price label, duration_days, payment_url, and active status.
- **Audit Log**: Immutable history of all administrative actions.

---

## 5. Security & Isolation Matrix

| Check | Specification | Verification Method |
| :--- | :--- | :--- |
| **No Leaked Secrets** | Remove hardcoded gateway key from `vite.config.js` and `.env`; store in server runtime secrets. | Shell search on `dist/` and repo for API keys. |
| **Server-Side Enforcement** | All data access and mutations checked on server; client UI only reflects permissions. | Direct `curl` requests without auth cookies receive 401/403. |
| **Tenant Isolation** | All queries filter by `business_id`; Business A cannot read/write Business B records. | Multi-tenant test script creating two distinct accounts. |
| **Reference Uniqueness** | Global uniqueness on `PaymentSubmission.reference_number`. | Duplicate submission test (T5). |
| **Admin Route Security** | `/admin` returns 404 for non-admin requests; zero admin UI leaked in client bundle. | Test non-admin session navigating to `/admin` (T2). |

---

## 6. Comprehensive 19-Point Test Matrix (T1 - T19)

- [ ] **T1**: Fresh browser profile lands on `/login`, not `/`.
- [ ] **T2**: Direct URLs (`/customers`, `/orders`, `/sales`, `/admin`, `/api/*`) show no protected data.
- [ ] **T3**: Two plans displayed; invalid email and phone inputs show clear validation errors.
- [ ] **T4**: PayNow creates `awaiting_payment` record and redirects in the same tab.
- [ ] **T5**: Returning without reference provides no access; duplicate reference is rejected.
- [ ] **T6**: Submitting reference opens app with amber "Under Verification" badge; notification created.
- [ ] **T7**: Admin approves payment: badge turns green ("Active until <date>" in Asia/Dubai time); double click prevented.
- [ ] **T8**: Admin rejects payment: user locked out with reason; resubmission enabled.
- [ ] **T9**: Valid coupon gives 48 hours access; double redemption and exhausted codes rejected.
- [ ] **T10**: Expired access immediately terminates access; reminder notifications generated.
- [ ] **T11**: Provisional window expiration locks out user until admin action.
- [ ] **T12**: Subscription renewal during active period starts from current expiry, not now (D7).
- [ ] **T13**: Admin revocation takes effect immediately on next request.
- [ ] **T14**: Strict tenant isolation verified between Business A and Business B.
- [ ] **T15**: `/order-online` displays paused notice when inactive, processes orders when active.
- [ ] **T16**: Regression: create customer, order, sale; A4 PDF tax invoice downloads; WhatsApp shows destination preview.
- [ ] **T17**: Mobile audit at 375px width: paywall, header bell, badge, and admin queue are responsive with 44px+ touch targets.
- [ ] **T18**: Zero console errors; `npm run build` and `npm run lint` pass cleanly.
- [ ] **T19**: All retired / legacy endpoints return no protected app content.

---

## 7. Open Questions for Approval (Section 15)

1. **Q1 (Canonical Link):** Which domain/URL should be configured as the canonical single link? (Currently `octapus-mehar.vercel.app` serves the storefront).
2. **Q2 (Multi-Tenancy):** Please confirm whether each business is a separate paying customer with separate databases/tenants (D3), or if this installation is dedicated to one shop.
3. **Q3 (Storefront Pausing):** Confirm that `/order-online` should display the paused/unavailable page whenever the business access is inactive (D4).
4. **Q4 (Separate Apps):** Are there existing separate repositories or deployments for the Paywall and Admin boards, or should both be fully embedded as first-class routes inside this single repository?
5. **Q5 (Initial Plan Details):** What are the initial production Plan names, price labels, durations, payment URLs, and provisional access windows?
