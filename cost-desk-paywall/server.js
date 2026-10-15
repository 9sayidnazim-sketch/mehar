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
  ZIINA_CLIENT_ID = 'test',
  ZIINA_CLIENT_SECRET = '',
  ZIINA_REDIRECT_URI = '',
  ZIINA_SCOPE = 'read_account write_payment_intents',
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
const ZIINA_AUTH = 'https://auth.ziina.com/oidc';
const ZIINA = 'https://api-v2.ziina.com/api';

// ---- Tiny JSON store (swap for your DB in production) --------------------
const DB_FILE = path.join(__dirname, 'data', 'db.json');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
let db = { licenses: {}, coupons: {}, intents: {}, oauth: {}, oauthStates: {} };
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.licenses) db.licenses = {};
    if (!db.coupons) db.coupons = {};
    if (!db.intents) db.intents = {};
    if (!db.oauth) db.oauth = {};
    if (!db.oauthStates) db.oauthStates = {};
  } catch (err) {
    console.error('Failed reading db.json, initializing fresh store:', err);
  }
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function getEffectiveZiinaToken() {
  const oauth = db.oauth?.ziina;
  if (oauth?.accessToken && (!oauth.expiresAt || oauth.expiresAt > Date.now())) {
    return { token: oauth.accessToken, source: 'oauth', account: oauth.account || null };
  }
  return { token: (ZIINA_API_KEY || '').trim(), source: 'static_api_key', account: null };
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

// Ziina OAuth: GET /api/ziina/oauth/authorize
app.get('/api/ziina/oauth/authorize', (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const basePublicUrl = PUBLIC_URL || `http://${host}`;
  const redirectUri = req.query?.redirect_uri || ZIINA_REDIRECT_URI || `${basePublicUrl}/api/ziina/oauth/callback`;
  const state = req.query?.state || crypto.randomBytes(16).toString('hex');
  const clientId = ZIINA_CLIENT_ID || 'test';
  const scope = 'read_account+write_payment_intents';

  if (!db.oauthStates) db.oauthStates = {};
  db.oauthStates[state] = { createdAt: now(), redirectUri, clientId };
  save();

  const authUrl = `${ZIINA_AUTH}/auth?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}`;

  if (req.query?.json === '1' || req.headers.accept?.includes('application/json')) {
    return res.json({ authorizeUrl: authUrl, clientId, redirectUri, scope, state });
  }
  res.redirect(authUrl);
});

// Ziina OAuth: GET /api/ziina/oauth/callback
app.get('/api/ziina/oauth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const host = req.headers.host || 'localhost:3000';
  const basePublicUrl = PUBLIC_URL || `http://${host}`;

  if (error) {
    return res.status(400).send(`<h1>Ziina Connection Error</h1><p>${error_description || error}</p><p><a href="/admin.html">Return to Admin</a></p>`);
  }
  if (!code) {
    return res.status(400).send(`<h1>Missing Code</h1><p>No authorization code received from Ziina.</p><p><a href="/admin.html">Return to Admin</a></p>`);
  }

  const savedState = state && db.oauthStates ? db.oauthStates[state] : null;
  const redirectUri = savedState?.redirectUri || ZIINA_REDIRECT_URI || `${basePublicUrl}/api/ziina/oauth/callback`;
  const clientId = savedState?.clientId || ZIINA_CLIENT_ID || 'test';
  const clientSecret = ZIINA_CLIENT_SECRET || '';

  if (state && db.oauthStates?.[state]) {
    delete db.oauthStates[state];
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    if (clientSecret) params.append('client_secret', clientSecret);

    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (clientId && clientSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    const tokenRes = await fetch(`${ZIINA_AUTH}/token`, {
      method: 'POST',
      headers,
      body: params.toString()
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Ziina Token Exchange Failed:', tokenRes.status, tokenData);
      return res.status(400).send(`<h1>Token Exchange Failed</h1><p>${tokenData.error_description || tokenData.error || 'Failed to exchange authorization code'}</p><p><a href="/admin.html">Return to Admin</a></p>`);
    }

    const accessToken = tokenData.access_token;
    const expiresIn = Number(tokenData.expires_in) || 3600;
    const expiresAt = now() + (expiresIn * 1000);

    let account = null;
    try {
      const accRes = await fetch(`${ZIINA}/account`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (accRes.ok) account = await accRes.json();
    } catch (_) {}

    if (!db.oauth) db.oauth = {};
    db.oauth.ziina = {
      accessToken,
      refreshToken: tokenData.refresh_token || null,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt,
      scope: tokenData.scope || 'read_account write_payment_intents',
      account,
      connectedAt: now(),
      clientId
    };
    save();

    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f172a;color:#f8fafc;">
      <h1 style="color:#34d399;">✓ Ziina Wallet Connected!</h1>
      <p>Your Ziina Business account has been authorized successfully.</p>
      <p><a href="/admin.html" style="color:#818cf8;font-weight:bold;">Return to Admin Console</a></p>
      <script>if(window.opener){window.opener.postMessage({type:'ziina_oauth_result',success:true},'*');}</script>
    </body></html>`);
  } catch (err) {
    res.status(500).send(`<h1>Internal Error</h1><p>${err.message}</p>`);
  }
});

// Ziina OAuth: GET /api/ziina/oauth/status
app.get('/api/ziina/oauth/status', (req, res) => {
  const host = req.headers.host || 'localhost:3000';
  const basePublicUrl = PUBLIC_URL || `http://${host}`;
  const oauth = db.oauth?.ziina;
  const isConnected = Boolean(oauth?.accessToken && (!oauth.expiresAt || oauth.expiresAt > now()));

  res.json({
    connected: isConnected,
    clientId: ZIINA_CLIENT_ID || 'test',
    redirectUri: ZIINA_REDIRECT_URI || `${basePublicUrl}/api/ziina/oauth/callback`,
    testMode: ZIINA_TEST !== 'false',
    account: oauth?.account || null,
    hasStaticApiKey: Boolean(ZIINA_API_KEY && ZIINA_API_KEY.trim().length > 0)
  });
});

// Ziina OAuth: POST /api/ziina/oauth/disconnect
app.post('/api/ziina/oauth/disconnect', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.headers['admin-key'];
  if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin secret key' });
  }
  if (db.oauth?.ziina) {
    delete db.oauth.ziina;
    save();
  }
  res.json({ disconnected: true });
});

// App configuration & public pricing
app.get('/api/config', (_req, res) => {
  const tokenInfo = getEffectiveZiinaToken();
  const oauth = db.oauth?.ziina;
  const isConnected = Boolean(oauth?.accessToken && (!oauth.expiresAt || oauth.expiresAt > now()));

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
    hasApiKey: Boolean(tokenInfo.token && tokenInfo.token.length > 0),
    authSource: tokenInfo.source,
    oauthConnected: isConnected,
    oauthAccount: oauth?.account || null
  });
});

// Start a Ziina checkout
app.post('/api/checkout', async (req, res) => {
  const planKey = req.body?.plan;
  const plan = PLANS[planKey];
  if (!plan) return res.status(400).json({ error: 'Unknown plan selected' });

  const authInfo = getEffectiveZiinaToken();
  if (!authInfo.token) {
    return res.status(500).json({ error: 'Ziina credentials not configured. Please connect via OAuth or set ZIINA_API_KEY.' });
  }

  const back = (s) => `${PUBLIC_URL}/paywall.html?status=${s}&pi={PAYMENT_INTENT_ID}`;
  try {
    const r = await fetch(`${ZIINA}/payment_intent`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authInfo.token}`,
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
  const authInfo = getEffectiveZiinaToken();
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
      headers: { Authorization: `Bearer ${authInfo.token}` },
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
