// Cost Desk Paywall & Ziina Payment Backend Service
// Compatible with Node.js HTTP servers, Express, Vite dev server, and Vercel Serverless Functions

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Load secrets from process.env or fallback to .env / .env.local
function getPaywallEnv() {
  if (!process.env.ZIINA_API_KEY) {
    const candidatePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local'),
      path.resolve(process.cwd(), 'cost-desk-paywall/.env')
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const lines = fs.readFileSync(p, 'utf8').split('\n');
          for (const line of lines) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (m) {
              const k = m[1];
              let v = m[2] || '';
              if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
              if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
              if (!process.env[k]) process.env[k] = v.trim();
            }
          }
        } catch (_) {}
      }
    }
  }

  return {
    ziinaApiKey: process.env.ZIINA_API_KEY || 'R4CBZI3tATCvc3qF0ZRPoxiT4wFBeWQHc6rejFqN/IUWPZMqDgT9b6WjctBABV3U',
    ziinaTest: process.env.ZIINA_TEST !== 'false',
    adminKey: process.env.ADMIN_KEY || 'admin12345',
    publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
    appUrl: process.env.APP_URL || '/app.html'
  };
}

// Pricing definitions (AED)
export const LIST_PRICE = 6000;
export const PLANS = {
  yearly:   { label: 'Yearly',   amount: 2222, days: 365, period: '1 year' },
  lifetime: { label: 'One-time', amount: 3200, days: null, period: 'Lifetime' }
};
export const COUPON_HOURS = 48;
export const ZIINA_API_BASE = 'https://api-v2.ziina.com/api';

// Storage setup with serverless /tmp fallback
const BASE_DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join('/tmp', '.data')
  : BASE_DATA_DIR;
const PAYWALL_DB_FILE = path.join(DATA_DIR, 'paywall_db.json');

function ensureStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PAYWALL_DB_FILE)) {
      // Check if cost-desk-paywall has existing db
      const existing = path.resolve(process.cwd(), 'cost-desk-paywall/data/db.json');
      if (fs.existsSync(existing)) {
        try { fs.copyFileSync(existing, PAYWALL_DB_FILE); } catch (_) {}
      } else {
        fs.writeFileSync(PAYWALL_DB_FILE, JSON.stringify({ licenses: {}, coupons: {}, intents: {} }, null, 2));
      }
    }
  } catch (_) {}
}

function loadDb() {
  ensureStore();
  try {
    if (fs.existsSync(PAYWALL_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PAYWALL_DB_FILE, 'utf8'));
      return {
        licenses: parsed.licenses || {},
        coupons: parsed.coupons || {},
        intents: parsed.intents || {}
      };
    }
  } catch (err) {
    console.error('[Paywall DB] Load error, resetting memory cache:', err.message);
  }
  return { licenses: {}, coupons: {}, intents: {} };
}

function saveDb(data) {
  ensureStore();
  try {
    const tmp = PAYWALL_DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, PAYWALL_DB_FILE);
  } catch (err) {
    try {
      fs.writeFileSync(PAYWALL_DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[Paywall DB] Save error:', e.message);
    }
  }
}

const now = () => Date.now();
const token = () => crypto.randomBytes(24).toString('base64url');

export function issueLicense({ plan, source, ref, hours, days }) {
  const db = loadDb();
  const t = token();
  const ms = hours ? hours * 3600e3 : days ? days * 86400e3 : null;
  db.licenses[t] = { plan, source, ref, createdAt: now(), expiresAt: ms ? now() + ms : null };
  saveDb(db);
  return { token: t, ...db.licenses[t] };
}

export function getLicenseStatus(t) {
  const db = loadDb();
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

export function getPaywallConfig(reqHost) {
  const env = getPaywallEnv();
  const pubUrl = env.publicUrl || (reqHost ? `https://${reqHost}` : 'http://localhost:3000');
  return {
    listPrice: LIST_PRICE,
    plans: Object.fromEntries(
      Object.entries(PLANS).map(([k, p]) => [
        k,
        { label: p.label, amount: p.amount, days: p.days, period: p.period }
      ])
    ),
    couponHours: COUPON_HOURS,
    appUrl: env.appUrl,
    test: env.ziinaTest,
    hasApiKey: Boolean(env.ziinaApiKey && env.ziinaApiKey.trim().length > 0)
  };
}

export async function handleCheckout(body, reqHost) {
  const env = getPaywallEnv();
  const planKey = body?.plan;
  const plan = PLANS[planKey];
  if (!plan) return { status: 400, body: { error: 'Unknown plan selected' } };
  if (!env.ziinaApiKey) {
    return { status: 500, body: { error: 'ZIINA_API_KEY is not configured on the server.' } };
  }

  const basePublicUrl = env.publicUrl || (reqHost ? `https://${reqHost}` : 'http://localhost:3000');
  const back = (s) => `${basePublicUrl}/paywall.html?status=${s}&pi={PAYMENT_INTENT_ID}`;

  try {
    const r = await fetch(`${ZIINA_API_BASE}/payment_intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ziinaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: plan.amount * 100, // Ziina fils
        currency_code: 'AED',
        message: `Cost Desk — ${plan.label} access`,
        success_url: back('success'),
        cancel_url: back('cancel'),
        failure_url: back('failed'),
        test: env.ziinaTest,
      }),
    });
    const pi = await r.json();

    if (!r.ok || !pi.redirect_url) {
      console.error('[Ziina Error]', r.status, pi);
      if (pi?.code === 'RECIPIENT_NOT_ACTIVE_WALLET') {
        return {
          status: 502,
          body: {
            error: 'Ziina merchant wallet is pending KYC activation in your Ziina Business account. In the meantime, you can test with 48-hour passes via the Admin Console.',
            code: pi.code
          }
        };
      }
      return { status: 502, body: { error: pi?.message || pi?.detail || 'Could not initiate Ziina checkout' } };
    }

    const db = loadDb();
    db.intents[pi.id] = {
      plan: planKey,
      amount: plan.amount * 100,
      createdAt: now(),
      license: null
    };
    saveDb(db);

    return { status: 200, body: { redirectUrl: pi.redirect_url, intentId: pi.id } };
  } catch (err) {
    console.error('[Ziina Connection Exception]', err);
    return { status: 502, body: { error: 'Payment service unreachable. Please check network connectivity.' } };
  }
}

export async function handleVerify(body) {
  const env = getPaywallEnv();
  const id = String(body?.pi || body?.id || '').trim();
  if (!id) return { status: 400, body: { error: 'Payment Intent ID is required' } };

  const db = loadDb();
  const intent = db.intents[id];
  if (!intent) {
    return { status: 404, body: { error: 'Unknown or expired payment intent session' } };
  }
  if (intent.license) {
    return { status: 200, body: { token: intent.license, ...getLicenseStatus(intent.license) } };
  }

  try {
    const r = await fetch(`${ZIINA_API_BASE}/payment_intent/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${env.ziinaApiKey}` },
    });
    const pi = await r.json();
    if (!r.ok) return { status: 502, body: { error: pi?.message || 'Could not confirm payment with Ziina' } };
    if (pi.status !== 'completed') return { status: 402, body: { error: 'Payment not completed', status: pi.status } };
    if (pi.amount !== intent.amount || pi.currency_code !== 'AED') {
      return { status: 400, body: { error: 'Payment amount or currency mismatch' } };
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
    saveDb(db);

    return { status: 200, body: { token: t, ...getLicenseStatus(t) } };
  } catch (err) {
    console.error('[Ziina Verify Exception]', err);
    return { status: 502, body: { error: 'Payment verification service error' } };
  }
}

export function handleCouponRedeem(body) {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) return { status: 400, body: { error: 'Please enter a coupon code' } };

  const db = loadDb();
  const c = db.coupons[code];
  if (!c) return { status: 404, body: { error: 'That code is not valid.' } };
  if (c.activatedAt) {
    const expired = c.activatedAt + COUPON_HOURS * 3600e3 < now();
    return {
      status: 409,
      body: { error: expired ? 'This coupon pass has expired.' : 'This code has already been redeemed.' }
    };
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
  saveDb(db);

  return { status: 200, body: { token: t, ...getLicenseStatus(t) } };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const part = () => Array.from(crypto.randomBytes(4), (b) => ALPHABET[b % ALPHABET.length]).join('');

export function handleAdminCreateCoupons(body, adminKeyHeader) {
  const env = getPaywallEnv();
  if (!env.adminKey || adminKeyHeader !== env.adminKey) {
    return { status: 401, body: { error: 'Unauthorized: Invalid admin secret key' } };
  }

  const count = Math.min(Math.max(parseInt(body?.count ?? 10, 10) || 10, 1), 100);
  const note = String(body?.note || '').trim();
  const db = loadDb();
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
  saveDb(db);

  return { status: 200, body: { codes, count: codes.length } };
}

export function handleAdminListCoupons(adminKeyHeader) {
  const env = getPaywallEnv();
  if (!env.adminKey || adminKeyHeader !== env.adminKey) {
    return { status: 401, body: { error: 'Unauthorized: Invalid admin secret key' } };
  }

  const db = loadDb();
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

  return {
    status: 200,
    body: {
      coupons: list,
      stats: {
        total: list.length,
        unused: list.filter((x) => x.status === 'unused').length,
        active: list.filter((x) => x.status === 'active').length,
        expired: list.filter((x) => x.status === 'expired').length,
      }
    }
  };
}
