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
    ziinaClientId: process.env.ZIINA_CLIENT_ID || 'test',
    ziinaClientSecret: process.env.ZIINA_CLIENT_SECRET || '',
    ziinaRedirectUri: process.env.ZIINA_REDIRECT_URI || '',
    ziinaScope: process.env.ZIINA_SCOPE || 'read_account write_payment_intents',
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
export const ZIINA_AUTH_BASE = 'https://auth.ziina.com/oidc';
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
        fs.writeFileSync(PAYWALL_DB_FILE, JSON.stringify({ licenses: {}, coupons: {}, intents: {}, oauth: {}, oauthStates: {} }, null, 2));
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
        intents: parsed.intents || {},
        oauth: parsed.oauth || {},
        oauthStates: parsed.oauthStates || {}
      };
    }
  } catch (err) {
    console.error('[Paywall DB] Load error, resetting memory cache:', err.message);
  }
  return { licenses: {}, coupons: {}, intents: {}, oauth: {}, oauthStates: {} };
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

export function getEffectiveZiinaToken() {
  const env = getPaywallEnv();
  const db = loadDb();
  const oauth = db.oauth?.ziina;
  if (oauth?.accessToken && typeof oauth.accessToken === 'string' && oauth.accessToken.trim()) {
    const exp = Number(oauth.expiresAt);
    if (!exp || exp > now()) {
      return {
        token: oauth.accessToken.trim(),
        source: 'oauth',
        account: oauth.account || null,
        expiresAt: exp || null
      };
    }
  }
  return {
    token: (env.ziinaApiKey || '').trim(),
    source: 'static_api_key',
    account: null,
    expiresAt: null
  };
}

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
  const tokenInfo = getEffectiveZiinaToken();
  const db = loadDb();
  const oauthConnected = Boolean(db.oauth?.ziina?.accessToken && (!db.oauth.ziina.expiresAt || db.oauth.ziina.expiresAt > now()));

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
    hasApiKey: Boolean(tokenInfo.token && tokenInfo.token.length > 0),
    authSource: tokenInfo.source,
    oauthConnected,
    oauthAccount: db.oauth?.ziina?.account || null
  };
}

export async function handleCheckout(body, reqHost) {
  const env = getPaywallEnv();
  const planKey = body?.plan;
  const plan = PLANS[planKey];
  if (!plan) return { status: 400, body: { error: 'Unknown plan selected' } };

  const authInfo = getEffectiveZiinaToken();
  if (!authInfo.token) {
    return { status: 500, body: { error: 'Ziina credentials not configured. Please connect via OAuth or set ZIINA_API_KEY.' } };
  }

  const basePublicUrl = env.publicUrl || (reqHost ? `https://${reqHost}` : 'http://localhost:3000');
  const back = (s) => `${basePublicUrl}/paywall.html?status=${s}&pi={PAYMENT_INTENT_ID}`;

  try {
    const r = await fetch(`${ZIINA_API_BASE}/payment_intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authInfo.token}`,
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
            error: 'Ziina merchant wallet is pending KYC activation in your Ziina Business account. You can connect your verified account via Ziina OAuth in the Admin Console, or test with 48-hour passes.',
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
  const authInfo = getEffectiveZiinaToken();
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
      headers: { Authorization: `Bearer ${authInfo.token}` },
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

// ---- Ziina OAuth 2.0 / OIDC Handshake ------------------------------------

function resolveBaseUrl(env, reqHost) {
  if (env.publicUrl && !env.publicUrl.includes('localhost')) return env.publicUrl;
  if (reqHost && !reqHost.includes('localhost')) return `https://${reqHost}`;
  return env.publicUrl || (reqHost ? `https://${reqHost}` : 'http://localhost:3000');
}

export function getZiinaOAuthAuthorizeUrl(reqHost, overrideState, overrideRedirectUri) {
  const env = getPaywallEnv();
  const basePublicUrl = resolveBaseUrl(env, reqHost);
  const redirectUri = overrideRedirectUri || env.ziinaRedirectUri || `${basePublicUrl}/api/ziina/oauth/callback`;
  const state = overrideState || crypto.randomBytes(16).toString('hex');
  const clientId = env.ziinaClientId || 'test';
  const scope = 'read_account+write_payment_intents';

  const db = loadDb();
  if (!db.oauthStates) db.oauthStates = {};
  db.oauthStates[state] = {
    createdAt: now(),
    redirectUri,
    clientId
  };
  // Prune states older than 1 hour
  for (const s of Object.keys(db.oauthStates)) {
    if (now() - db.oauthStates[s].createdAt > 3600e3) {
      delete db.oauthStates[s];
    }
  }
  saveDb(db);

  const authUrl = `${ZIINA_AUTH_BASE}/auth?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}`;

  return {
    authorizeUrl: authUrl,
    clientId,
    redirectUri,
    scope,
    state
  };
}

export async function handleZiinaOAuthCallback(query, reqHost) {
  const env = getPaywallEnv();
  const basePublicUrl = resolveBaseUrl(env, reqHost);

  if (query?.error) {
    return {
      success: false,
      error: query.error_description || query.error || 'Authorization was rejected by Ziina.',
      code: query.error
    };
  }

  const code = query?.code;
  const state = query?.state;

  if (!code) {
    return {
      success: false,
      error: 'Missing authorization code in Ziina callback response.'
    };
  }

  const db = loadDb();
  const savedState = state && db.oauthStates ? db.oauthStates[state] : null;
  const redirectUri = savedState?.redirectUri || env.ziinaRedirectUri || `${basePublicUrl}/api/ziina/oauth/callback`;
  const clientId = savedState?.clientId || env.ziinaClientId || 'test';
  const clientSecret = env.ziinaClientSecret || '';

  if (state && db.oauthStates?.[state]) {
    delete db.oauthStates[state];
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (clientId && clientSecret) {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const tokenRes = await fetch(`${ZIINA_AUTH_BASE}/token`, {
      method: 'POST',
      headers,
      body: params.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Ziina OAuth Token Exchange Failed]', tokenRes.status, tokenData);
      return {
        success: false,
        error: tokenData.error_description || tokenData.error || tokenData.message || 'Failed to exchange authorization code for access token.',
        status: tokenRes.status,
        details: tokenData
      };
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const expiresAt = now() + (expiresIn * 1000);
    const scope = tokenData.scope || 'read_account write_payment_intents';

    let account = null;
    try {
      const accRes = await fetch(`${ZIINA_API_BASE}/account`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (accRes.ok) {
        account = await accRes.json();
      }
    } catch (accErr) {
      console.warn('[Ziina Account Fetch Warning]', accErr.message);
    }

    if (!db.oauth) db.oauth = {};
    db.oauth.ziina = {
      accessToken,
      refreshToken,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt,
      scope,
      account,
      connectedAt: now(),
      clientId
    };
    saveDb(db);

    return {
      success: true,
      account,
      expiresAt,
      scope,
      clientId
    };
  } catch (err) {
    console.error('[Ziina OAuth Exchange Exception]', err);
    return {
      success: false,
      error: `Network error exchanging token with Ziina: ${err.message}`
    };
  }
}

export function getZiinaOAuthStatus(reqHost) {
  const env = getPaywallEnv();
  const db = loadDb();
  const basePublicUrl = resolveBaseUrl(env, reqHost);
  const redirectUri = env.ziinaRedirectUri || `${basePublicUrl}/api/ziina/oauth/callback`;
  const oauth = db.oauth?.ziina;
  const isConnected = Boolean(oauth?.accessToken && (!oauth.expiresAt || oauth.expiresAt > now()));

  return {
    connected: isConnected,
    clientId: env.ziinaClientId || 'test',
    redirectUri,
    scope: env.ziinaScope,
    testMode: env.ziinaTest,
    expiresAt: oauth?.expiresAt || null,
    connectedAt: oauth?.connectedAt || null,
    account: oauth?.account || null,
    hasStaticApiKey: Boolean(env.ziinaApiKey && env.ziinaApiKey.trim().length > 0)
  };
}

export function handleZiinaOAuthDisconnect(adminKeyHeader) {
  const env = getPaywallEnv();
  if (!env.adminKey || adminKeyHeader !== env.adminKey) {
    return { status: 401, body: { error: 'Unauthorized: Invalid admin secret key' } };
  }

  const db = loadDb();
  if (db.oauth?.ziina) {
    delete db.oauth.ziina;
    saveDb(db);
  }

  return { status: 200, body: { disconnected: true, message: 'Ziina OAuth session unlinked successfully.' } };
}

export function renderOAuthCallbackHtml(result, basePublicUrl = '') {
  const isSuccess = Boolean(result?.success);
  const title = isSuccess ? 'Ziina Wallet Connected' : 'Ziina Connection Notice';
  const subtitle = isSuccess
    ? 'Your Ziina merchant account has been authenticated and linked for payment processing.'
    : (result?.error || 'Could not complete the OAuth handshake with Ziina.');
  const details = result?.account
    ? JSON.stringify(result.account, null, 2)
    : result?.details
    ? JSON.stringify(result.details, null, 2)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Cost Desk</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #07090e;
      color: #f8fafc;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image: radial-gradient(circle at 50% 0%, ${isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'} 0%, transparent 60%);
    }
    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
      border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
    }
    .icon-wrap svg {
      width: 32px;
      height: 32px;
      stroke: ${isSuccess ? '#34d399' : '#f87171'};
      stroke-width: 2.2;
      fill: none;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 10px;
      letter-spacing: -0.02em;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .details-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      color: #cbd5e1;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-all;
      margin-bottom: 24px;
      max-height: 160px;
      overflow-y: auto;
    }
    .btn-row {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      padding: 12px 22px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
      color: white;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      ${isSuccess
        ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
    </div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    ${details ? `<div class="details-box">${details}</div>` : ''}
    <div class="btn-row">
      <a href="${basePublicUrl || ''}/admin.html" class="btn btn-primary">Admin Console</a>
      <a href="${basePublicUrl || ''}/paywall.html" class="btn btn-secondary">Open Paywall</a>
    </div>
  </div>
  <script>
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'ziina_oauth_result', success: ${isSuccess} }, '*');
      }
    } catch (_) {}
  </script>
</body>
</html>`;
}

