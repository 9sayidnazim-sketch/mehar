# Cost Desk Paywall (Ziina)

Production-ready paywall and license enforcement server for Cost Desk with a crossed-out AED 6,000 list price, Ziina UAE payment intents, and self-expiring 48-hour promotional coupon passes.

| Plan | Price | Access | Billing |
|---|---|---|---|
| **Yearly** — Subscribe | **AED 2,222** | 365 days | Annual single payment |
| **One-time** — Purchase | **AED 3,200** | Lifetime | Single payment (Never expires) |
| **Coupon Pass** | **FREE** | 48 Hours | Single-use coupon activation |

---

## Architecture & Pages

- **`/paywall.html`**: Premium customer-facing paywall. Supports plan selection, instant Ziina redirection, automatic payment verification via URL return parameter (`?status=success&pi=...`), 48-hour coupon code redemption, and active license recognition.
- **`/admin.html`**: Password-protected coupon management console (`x-admin-key`). Generate batches of 1–100 coupons, copy codes or share links in one click, and track real-time status (`unused`, `active`, `expired`) with remaining hour countdowns.
- **`/gate.js`**: Lightweight script to include in the Cost Desk application. Verifies access with `/api/access`, redirects unauthorized users to `/paywall.html`, and automatically locks the session when a 48-hour pass expires in real-time.
- **`/app.html`**: Included demo application showcasing how unlocked users interact with the app, status badge display, and automatic lock triggers.

---

## Quick Setup (5 Minutes)

### 1. Requirements
- Node.js 20.6 or newer (supports built-in `fetch` and `--env-file`).

### 2. Install dependencies
```bash
cd cost-desk-paywall
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
# Ziina API credentials (https://business.ziina.com/)
ZIINA_API_KEY=your_ziina_api_key_here
ZIINA_TEST=true

# Admin secret for /admin.html coupon generation
ADMIN_KEY=your_secure_admin_key

# Public URL (where Ziina redirects buyers back)
PUBLIC_URL=http://localhost:3000

# App URL (where users land after unlocking)
APP_URL=/app.html

PORT=3000
```

### 4. Start the server
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### 5. Access
- Paywall: [http://localhost:3000/paywall.html](http://localhost:3000/paywall.html)
- Admin: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## How Payment & Verification Works

1. Buyer visits `/paywall.html` and chooses **Yearly** (AED 2,222) or **Lifetime** (AED 3,200).
2. The frontend sends `POST /api/checkout`. The server requests a Payment Intent from Ziina with amount in fils (`amount * 100`) and returns the Ziina hosted checkout URL.
3. The buyer completes payment on Ziina (Apple Pay, Google Pay, Visa, Mastercard).
4. Ziina redirects the buyer back to:
   ```
   /paywall.html?status=success&pi={PAYMENT_INTENT_ID}
   ```
5. The paywall page calls `POST /api/verify` with `{ pi }`.
6. The server validates directly with `api-v2.ziina.com` that the status is `completed` and the amount and currency match. Upon confirmation, a cryptographically secure token is issued and stored in `data/db.json`.
7. The browser stores `costdesk_license_token` in `localStorage` and unlocks access to `APP_URL`.

---

## How Coupons Work

1. Admin opens `/admin.html`, enters the `ADMIN_KEY`, and generates codes (e.g. `CD-9X4K-7W2P`).
2. Admin copies the code or direct share link (`/paywall.html?code=CD-9X4K-7W2P`).
3. User enters or auto-fills the code on `/paywall.html`.
4. The server validates that the code is unused, marks it `activatedAt = now()`, issues a 48-hour license, and records `expiresAt = now() + 48 hours`.
5. Each code can only be activated once.

---

## Protecting Your App With `gate.js`

Add this script tag into the `<head>` or top of your Cost Desk HTML page:

```html
<script src="/gate.js"></script>
```

Optional HTML attributes:
- `data-paywall-url="/paywall.html"`: Custom path to paywall.
- `data-app-name="Cost Desk"`: Branding name in alerts.

`gate.js` will:
- Check for `costdesk_license_token` in `localStorage`.
- Verify with `/api/access?token=...`.
- Redirect locked or expired users to `/paywall.html?redirect=...`.
- Set an in-memory timer to auto-lock the application the exact second a 48-hour coupon pass expires.
- Expose `window.CostDeskAccess` for custom UI integrations.
