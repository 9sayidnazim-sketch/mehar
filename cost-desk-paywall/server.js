// Cost Desk paywall server — Ziina payments + 2-day coupon passes
// Node 20.6+ (uses built-in fetch and --env-file)

import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  ZIINA_API_KEY,
  ZIINA_TEST = 'true',            // set to "false" to take real payments
  ADMIN_KEY,                      // protects coupon admin endpoints
  PUBLIC_URL = 'http://localhost:3000',
  APP_URL = '/app.html',          // where users go after they unlock
  PORT = 3000,
} = process.env;

// ---- Pricing (AED) -------------------------------------------------------
const LIST_PRICE = 6000;
const PLANS = {
  yearly:   { label: 'Yearly',   amount: 2222, days: 365, period: '1 year' },
  lifetime: { label: 'One-time', amount: 3200, days: null, period: 'Lifetime' }, // null = never expires
};
const COUPON_HOURS = 48;          // pass length, counted from activation
const ZIINA = 'https://api-v2.ziina.com/api';

// ---- Tiny JSON store (swap for your DB in production) --------------------
const DB_FILE = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
let db = { licenses: {}, coupons: {}, intents: {} };
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.licenses) db.licenses = {};
    if (!db.coupons) db.coupons = {};
    if (!db.intents) db.intents = {};
  } catch (err) {
    console.error('Failed reading db.json, initializing fresh store:', err);
  }
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const now = () => Date.now();
const token = () => crypto.randomBytes(24).toString('base64url');

function issueLicense({ plan, source, ref, hours, days }) {
  const t = token();
  const ms = hours ? hours * 3600e3 : days ? days * 86400e3 : null;
  db.licenses[t] = { plan, source, ref, createdAt: now(), expiresAt: ms ? now() + ms : null };
  save();
  return { token: t, ...db.licenses[t] };
}

function licenseStatus(t) {
  const l = t && db.licenses[t];
  if (!l) return { active: false };
  const active = l.expiresAt === null || l.expiresAt > now();
  const planInfo = PLANS[l.plan] || (l.plan === 'coupon' ? { label: '48-Hour Coupon Pass' } : { label: l.plan });
  return {
    active,
    plan: l.plan,
    planLabel: planInfo.label,
    source: l.source,
    createdAt: l.createdAt,
    expiresAt: l.expiresAt,
    remainingMs: l.expiresAt ? Math.max(0, l.expiresAt - now()) : null
  };
}

// ---- App -----------------------------------------------------------------
const app = express();
app.use(express.json());

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Root redirect to /paywall.html if no index.html is in public
app.get('/', (req, res, next) => {
  if (fs.existsSync(path.join(__dirname, 'public', 'index.html'))) {
    return next();
  }
  res.redirect('/paywall.html');
});

// App configuration & public pricing
app.get('/api/config', (_req, res) => {
  res.json({
    listPrice: LIST_PRICE,
    plans: Object.fromEntries(
      Object.entries(PLANS).map(([k, p]) => [
        k,
        { label: p.label, amount: p.amount, days: p.days, period: p.period }
      ])
    ),
    couponHours: COUPON_HOURS,
    appUrl: APP_URL,
    test: ZIINA_TEST !== 'false',
    hasApiKey: Boolean(ZIINA_API_KEY && ZIINA_API_KEY.trim().length > 0)
  });
});

// Start a Ziina checkout
app.post('/api/checkout', async (req, res) => {
  const planKey = req.body?.plan;
  const plan = PLANS[planKey];
  if (!plan) return res.status(400).json({ error: 'Unknown plan selected' });
  if (!ZIINA_API_KEY) {
    return res.status(500).json({ error: 'ZIINA_API_KEY is not configured on the server. Please check your .env file.' });
  }

  const back = (s) => `${PUBLIC_URL}/paywall.html?status=${s}&pi={PAYMENT_INTENT_ID}`;
  try {
    const r = await fetch(`${ZIINA}/payment_intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ZIINA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: plan.amount * 100, // Ziina expects minor units (fils: 1 AED = 100 fils)
        currency_code: 'AED',
        message: `Cost Desk — ${plan.label} access`,
        success_url: back('success'),
        cancel_url: back('cancel'),
        failure_url: back('failed'),
        test: ZIINA_TEST !== 'false',
      }),
    });
    const pi = await r.json();
    if (!r.ok || !pi.redirect_url) {
      console.error('Ziina Payment Intent Error:', r.status, pi);
      return res.status(502).json({ error: pi?.message || pi?.detail || 'Could not initiate Ziina payment session' });
    }
    db.intents[pi.id] = {
      plan: planKey,
      amount: plan.amount * 100,
      createdAt: now(),
      license: null
    };
    save();
    res.json({ redirectUrl: pi.redirect_url, intentId: pi.id });
  } catch (e) {
    console.error('Ziina Connection Error:', e);
    res.status(502).json({ error: 'Payment service unreachable. Please check network connection.' });
  }
});

// Confirm payment server-side (never trust the redirect query alone)
app.post('/api/verify', async (req, res) => {
  const id = String(req.body?.pi || req.body?.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Payment Intent ID is required' });

  const intent = db.intents[id];
  if (!intent) {
    return res.status(404).json({ error: 'Unknown or expired payment intent session' });
  }
  if (intent.license) {
    return res.json({ token: intent.license, ...licenseStatus(intent.license) });
  }

  try {
    const r = await fetch(`${ZIINA}/payment_intent/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${ZIINA_API_KEY}` },
    });
    const pi = await r.json();
    if (!r.ok) {
      console.error('Ziina Verification Error:', r.status, pi);
      return res.status(502).json({ error: pi?.message || 'Could not confirm payment with Ziina' });
    }
    if (pi.status !== 'completed') {
      return res.status(402).json({ error: 'Payment not completed', status: pi.status });
    }
    if (pi.amount !== intent.amount || pi.currency_code !== 'AED') {
      return res.status(400).json({ error: 'Payment amount or currency mismatch' });
    }

    const t = token();
    const plan = PLANS[intent.plan];
    const ms = plan.days ? plan.days * 86400e3 : null;
    db.licenses[t] = {
      plan: intent.plan,
      source: 'ziina',
      ref: id,
      createdAt: now(),
      expiresAt: ms ? now() + ms : null
    };
    intent.license = t;
    save();
    res.json({ token: t, ...licenseStatus(t) });
  } catch (e) {
    console.error('Ziina Verification Exception:', e);
    res.status(502).json({ error: 'Payment service unreachable during verification' });
  }
});

// Redeem a coupon → 48h pass from first use; one use per code
app.post('/api/coupon/redeem', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Please enter a coupon code' });

  const c = db.coupons[code];
  if (!c) return res.status(404).json({ error: 'That code is not valid.' });
  if (c.activatedAt) {
    const expired = c.activatedAt + COUPON_HOURS * 3600e3 < now();
    return res.status(409).json({
      error: expired
        ? 'This coupon pass has expired.'
        : 'This code has already been redeemed.'
    });
  }
  const t = token();
  const ms = COUPON_HOURS * 3600e3;
  db.licenses[t] = {
    plan: 'coupon',
    source: 'coupon',
    ref: code,
    createdAt: now(),
    expiresAt: now() + ms
  };
  c.activatedAt = now();
  c.license = t;
  save();
  res.json({ token: t, ...licenseStatus(t) });
});

// License validation endpoint (used by gate.js)
app.get('/api/access', (req, res) => {
  const tokenStr = String(req.query.token || '').trim();
  res.json(licenseStatus(tokenStr));
});

// ---- Admin: coupons ------------------------------------------------------
function admin(req, res, next) {
  if (!ADMIN_KEY || req.get('x-admin-key') !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin secret key' });
  }
  next();
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const part = () => Array.from(crypto.randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');

// Generate coupons
app.post('/api/admin/coupons', admin, (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body?.count ?? 10, 10) || 10, 1), 100);
  const note = String(req.body?.note || '').trim();
  const codes = [];
  while (codes.length < count) {
    const code = `CD-${part()}-${part()}`;
    if (db.coupons[code]) continue;
    db.coupons[code] = {
      createdAt: now(),
      activatedAt: null,
      license: null,
      note: note
    };
    codes.push(code);
  }
  save();
  res.json({ codes, count: codes.length });
});

// List coupons
app.get('/api/admin/coupons', admin, (_req, res) => {
  const list = Object.entries(db.coupons)
    .map(([code, c]) => {
      const expiresAt = c.activatedAt ? c.activatedAt + COUPON_HOURS * 3600e3 : null;
      const status = !c.activatedAt ? 'unused' : expiresAt > now() ? 'active' : 'expired';
      const remainingMs = expiresAt && expiresAt > now() ? expiresAt - now() : 0;
      return {
        code,
        status,
        createdAt: c.createdAt,
        activatedAt: c.activatedAt,
        expiresAt,
        remainingMs,
        note: c.note || ''
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json({
    coupons: list,
    stats: {
      total: list.length,
      unused: list.filter((x) => x.status === 'unused').length,
      active: list.filter((x) => x.status === 'active').length,
      expired: list.filter((x) => x.status === 'expired').length,
    }
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`💳 Cost Desk Paywall Server running at:`);
  console.log(`   ➜ Local:   http://localhost:${PORT}`);
  console.log(`   ➜ Public:  ${PUBLIC_URL}`);
  console.log(`   ➜ Mode:    Ziina ${ZIINA_TEST !== 'false' ? '🧪 TEST / SANDBOX' : '🟢 LIVE PRODUCTION'}`);
  console.log(`   ➜ Paywall: ${PUBLIC_URL}/paywall.html`);
  console.log(`   ➜ Admin:   ${PUBLIC_URL}/admin.html`);
  console.log(`======================================================\n`);
});
