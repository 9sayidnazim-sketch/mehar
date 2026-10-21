import http from 'node:http';
import { execSync } from 'node:child_process';

console.log('🚀 Running Full Verification for THREDO (Mehar Tailors)...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
    throw new Error(message);
  } else {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  }
}

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://127.0.0.1:5173${path}`, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('--- Step 1: Checking Local Dev Server HTTP Endpoints ---');

  // 1. Root HTML
  try {
    const res = await request('/');
    assert(res.statusCode === 200, 'GET / returns 200 OK');
    assert(res.body.includes('THREDO'), 'Root HTML includes THREDO title');
    assert(res.body.includes('id="root"'), 'Root HTML includes react mount node');
  } catch (e) {
    console.error('Root request error:', e.message);
  }

  // 2. Mock Entities
  const entities = ['Customer', 'Order', 'Sale', 'Tailor', 'Payment'];
  for (const ent of entities) {
    try {
      const res = await request(`/entities/${ent}`);
      assert(res.statusCode === 200, `GET /entities/${ent} returns 200 OK`);
      const data = JSON.parse(res.body);
      assert(Array.isArray(data), `GET /entities/${ent} returns array`);
    } catch (e) {
      console.error(`Entities error (${ent}):`, e.message);
    }
  }

  // 3. API Functions
  try {
    const accessRes = await request('/api/functions/getAccessState');
    assert(accessRes.statusCode === 200, 'GET /api/functions/getAccessState returns 200 OK');
    const accessData = JSON.parse(accessRes.body);
    assert(accessData.access && accessData.access.allowed, 'getAccessState returns allowed=true');
  } catch (e) {
    console.error('Access state error:', e.message);
  }

  try {
    const notifRes = await request('/api/functions/getNotifications');
    assert(notifRes.statusCode === 200, 'GET /api/functions/getNotifications returns 200 OK');
    const notifData = JSON.parse(notifRes.body);
    assert(Array.isArray(notifData.notifications), 'getNotifications returns notifications array');
  } catch (e) {
    console.error('Notifications error:', e.message);
  }

  // 4. WhatsApp Orbit Endpoints
  try {
    const statusRes = await request('/api/whatsapp/status');
    assert(statusRes.statusCode === 200 || statusRes.statusCode === 503, 'GET /api/whatsapp/status responds with valid status code');
    const statusData = JSON.parse(statusRes.body);
    assert(typeof statusData.ok === 'boolean', 'whatsapp/status returns boolean ok');
  } catch (e) {
    console.error('WhatsApp status error:', e.message);
  }

  try {
    const qrRes = await request('/api/whatsapp/qr');
    assert(qrRes.statusCode === 200, 'GET /api/whatsapp/qr responds with 200 OK');
    const qrData = JSON.parse(qrRes.body);
    assert(qrData.ok === true, 'whatsapp/qr returns ok=true');
  } catch (e) {
    console.error('WhatsApp QR error:', e.message);
  }

  console.log('\n--- Step 2: Running Automated Business Logic Test Suite ---');
  try {
    const suiteOutput = execSync('node scratch/test-suite.js', { encoding: 'utf8' });
    assert(suiteOutput.includes('22 PASSED, 0 FAILED'), 'test-suite.js passed all 22 tests cleanly');
  } catch (e) {
    assert(false, `test-suite.js failed: ${e.message}`);
  }

  console.log('\n--- Step 3: Running ESLint and Production Build Checks ---');
  try {
    execSync('npm run lint', { encoding: 'utf8' });
    assert(true, 'npm run lint passed with 0 errors');
  } catch (e) {
    assert(false, `npm run lint failed: ${e.message}`);
  }

  try {
    execSync('npm run build', { encoding: 'utf8' });
    assert(true, 'npm run build generated production bundle cleanly');
  } catch (e) {
    assert(false, `npm run build failed: ${e.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

run();
