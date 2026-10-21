// Live Production Verification for Ziina OIDC OAuth 2.0 on Vercel
const BASE_URL = 'https://octapusthredoo.vercel.app';

async function run() {
  console.log(`🚀 Verifying live production Ziina OAuth at: ${BASE_URL}\n`);
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Config Check
  await test('GET /api/config reports oauth telemetry', async () => {
    const res = await fetch(`${BASE_URL}/api/config`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!('oauthConnected' in data)) throw new Error('Missing oauthConnected field');
    if (!('authSource' in data)) throw new Error('Missing authSource field');
    if (data.listPrice !== 6000) throw new Error('Invalid listPrice');
  });

  // 2. OAuth Status Check
  await test('GET /api/ziina/oauth/status', async () => {
    const res = await fetch(`${BASE_URL}/api/ziina/oauth/status`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!('connected' in data)) throw new Error('Missing connected field');
    if (!data.redirectUri || !data.redirectUri.includes('/api/ziina/oauth/callback')) {
      throw new Error(`Unexpected redirectUri: ${data.redirectUri}`);
    }
  });

  // 3. OAuth Authorize URL JSON Response
  await test('GET /api/ziina/oauth/authorize?json=1', async () => {
    const res = await fetch(`${BASE_URL}/api/ziina/oauth/authorize?json=1`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.authorizeUrl.startsWith('https://auth.ziina.com/oidc/auth')) {
      throw new Error(`Invalid authorizeUrl domain: ${data.authorizeUrl}`);
    }
    if (!data.authorizeUrl.includes('response_type=code')) {
      throw new Error('Missing response_type=code');
    }
    if (!data.authorizeUrl.includes('read_account') || !data.authorizeUrl.includes('write_payment_intents')) {
      throw new Error('Missing required scopes');
    }
    if (!data.state) throw new Error('Missing state parameter');
  });

  // 4. OAuth Authorize with User Spec Parameters
  await test('GET /api/ziina/oauth/authorize with custom spec params (?state=xyz123&redirect_uri=https://example.com/callback)', async () => {
    const res = await fetch(`${BASE_URL}/api/ziina/oauth/authorize?state=xyz123&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&json=1`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.authorizeUrl.includes('state=xyz123')) throw new Error('State not reflected');
    if (!data.authorizeUrl.includes(encodeURIComponent('https://example.com/callback'))) {
      throw new Error('Custom redirect URI not reflected');
    }
    console.log(`      Sample URL: ${data.authorizeUrl}`);
  });

  // 5. OAuth Authorize 302 Redirect Check
  await test('GET /api/ziina/oauth/authorize browser 302 redirect', async () => {
    const res = await fetch(`${BASE_URL}/api/ziina/oauth/authorize`, { redirect: 'manual' });
    if (res.status !== 302 && res.status !== 307) {
      throw new Error(`Expected redirect status (302/307), got ${res.status}`);
    }
    const loc = res.headers.get('location');
    if (!loc || !loc.startsWith('https://auth.ziina.com/oidc/auth')) {
      throw new Error(`Invalid location header: ${loc}`);
    }
  });

  // 6. OAuth Callback Rejection Handling
  await test('GET /api/ziina/oauth/callback with error param renders notice page', async () => {
    const res = await fetch(`${BASE_URL}/api/ziina/oauth/callback?error=access_denied&error_description=User+declined+permission`);
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('Ziina Connection Notice')) throw new Error('Missing notice title');
  });

  // 7. Admin UI renders Ziina OAuth Integration Card
  await test('GET /admin.html includes Ziina OAuth 2.0 Integration Panel', async () => {
    const res = await fetch(`${BASE_URL}/admin.html`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    if (!text.includes('Ziina UAE Wallet & OAuth 2.0 Integration')) {
      throw new Error('Admin HTML missing Ziina OAuth card');
    }
    if (!text.includes('btnConnectZiina')) {
      throw new Error('Admin HTML missing Connect button');
    }
  });

  // 8. Paywall UI is healthy
  await test('GET /paywall.html loads successfully', async () => {
    const res = await fetch(`${BASE_URL}/paywall.html`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    if (!text.includes('Cost Desk')) throw new Error('Paywall missing Cost Desk branding');
  });

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

run();
