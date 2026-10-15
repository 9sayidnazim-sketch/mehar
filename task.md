# Task Tracking: THREDO Single-Link Access System

## Phase 1: Repo Inspection & Baseline Setup
- [x] Read AGENTS.md, README.md, and inspect repo at `/Users/ceooctapus/.gemini/antigravity-ide/scratch/mehar-tailors`.
- [x] Create and checkout branch `feat/single-link-access`.
- [x] Export all localStorage seed data (`thredo_db_*`) to `scratch/thredo_db_export.json`.
- [x] Write `implementation_plan.md` and `task.md`.
- [ ] Submit plan & open questions to user; await explicit approval before code implementation.

## Phase 2: Security & Backend Sanitization (Post-Approval)
- [ ] Remove hardcoded `GATEWAY_API_KEY` from `vite.config.js` and `.env`.
- [ ] Move WhatsApp gateway dispatch to serverless function `sendWhatsAppInvoiceServer` reading keys from runtime secrets.
- [ ] Remove dev-only `/api/gateway` proxy from production build.
- [ ] Verify build output contains no leaked secrets.

## Phase 3: Data Model & Base44 Entities (Post-Approval)
- [ ] Create `base44/entities/Business.jsonc`.
- [ ] Create `base44/entities/SubscriptionPlan.jsonc`.
- [ ] Create `base44/entities/Subscription.jsonc`.
- [ ] Create `base44/entities/PaymentSubmission.jsonc`.
- [ ] Create `base44/entities/Coupon.jsonc`.
- [ ] Create `base44/entities/CouponRedemption.jsonc`.
- [ ] Create `base44/entities/AccessGrant.jsonc`.
- [ ] Create `base44/entities/AppNotification.jsonc`.
- [ ] Create `base44/entities/AuditLog.jsonc`.
- [ ] Update `base44/entities/User.jsonc` and existing business entities to include `business_id`.

## Phase 4: Server Functions & Access Logic (Post-Approval)
- [ ] Implement `getAccessState` (priority: admin > subscription > coupon > provisional > none).
- [ ] Implement `initiatePayment` (snapshot plan, validate E.164 phone, idempotency key).
- [ ] Implement `submitPaymentReference` (regex validation, uniqueness, 48h provisional access).
- [ ] Implement `redeemCoupon` (rate limit, single redemption per business, 48h exact grant).
- [ ] Implement `adminApprovePayment` (D7 renewal extension logic, single-update guard).
- [ ] Implement `adminRejectPayment` (mandatory reason, audit logging).
- [ ] Implement `getNotifications` & `markNotificationsRead`.
- [ ] Implement `submitOnlineOrder` with access check (D4 paused storefront behavior).

## Phase 5: Client-Side Routing & UI Components (Post-Approval)
- [ ] Wire real Base44 SDK in `src/api/base44Client.js` (remove localStorage mock from production).
- [ ] Add `/login`, `/register`, `/forgot-password`, `/reset-password` routes to `src/App.jsx`.
- [ ] Implement `AccessGuard` component preventing protected data leak.
- [ ] Build Paywall page with 2 plans, details form, PayNow redirect, reference input, and coupon redemption.
- [ ] Build `/admin` console (payments queue, business access manager, coupon manager, plan editor, audit log).
- [ ] Upgrade header bell to interactive live notifications popover.
- [ ] Add dynamic access status badge in `AppLayout` top bar.

## Phase 6: Full Test Matrix Execution (T1 - T19)
- [ ] T1: Fresh profile lands on sign-in.
- [ ] T2: Direct URLs reveal no protected data.
- [ ] T3: Two plans & input validation.
- [ ] T4: PayNow creates awaiting_payment record & redirects.
- [ ] T5: No access without reference; duplicate reference rejected.
- [ ] T6: Reference submission starts provisional access with badge.
- [ ] T7: Admin approval extends access & notifies user.
- [ ] T8: Admin rejection locks out with reason.
- [ ] T9: 48h coupon validation & single-use guarantee.
- [ ] T10: Expiry terminates access immediately.
- [ ] T11: Provisional window end locks out until admin action.
- [ ] T12: Renewal extends from old expiry, not now.
- [ ] T13: Revocation takes immediate effect.
- [ ] T14: Multi-tenant business data isolation.
- [ ] T15: `/order-online` paused when inactive, active when current.
- [ ] T16: Regression test (PDF tax invoice, WhatsApp destination preview).
- [ ] T17: Mobile 375px audit with 44px+ touch targets.
- [ ] T18: Console audit, `npm run build`, `npm run lint`.
- [ ] T19: Retired links return no app content.

## Phase 7: Walkthrough & Delivery
- [ ] Document all changes and verification evidence in `walkthrough.md`.
- [ ] Provide clear manual instructions for gateway secret rotation, initial admin creation, and plan URL setup.
