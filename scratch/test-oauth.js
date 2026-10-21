// Verification test suite for Ziina OIDC OAuth 2.0 Integration
import assert from 'node:assert';
import {
  getZiinaOAuthAuthorizeUrl,
  handleZiinaOAuthCallback,
  getZiinaOAuthStatus,
  handleZiinaOAuthDisconnect,
  getEffectiveZiinaToken,
  renderOAuthCallbackHtml,
  getPaywallConfig
} from '../server/paywallBackend.js';

console.log('🧪 Starting Ziina OIDC OAuth Test Suite...\n');

// Test 1: Authorize URL Generation matching user spec
console.log('Test 1: Testing getZiinaOAuthAuthorizeUrl...');
const customState = 'xyz123';
const customRedirectUri = 'https://example.com/callback';
const authData = getZiinaOAuthAuthorizeUrl('octapusthredoo.vercel.app', customState, customRedirectUri);

console.log('Generated Authorize URL:', authData.authorizeUrl);
assert(authData.authorizeUrl.startsWith('https://auth.ziina.com/oidc/auth'), 'Must start with Ziina OIDC auth URL');
assert(authData.authorizeUrl.includes('response_type=code'), 'Must have response_type=code');
assert(authData.authorizeUrl.includes('scope=read_account%2Bwrite_payment_intents') || authData.authorizeUrl.includes('scope=read_account+write_payment_intents'), 'Must have requested scopes');
assert(authData.authorizeUrl.includes('state=xyz123'), 'Must contain state xyz123');
assert(authData.authorizeUrl.includes(encodeURIComponent(customRedirectUri)), 'Must contain encoded redirectUri');
console.log('✓ Test 1 passed: Authorize URL matches Ziina OIDC specifications exactly.\n');

// Test 2: OAuth Status Check
console.log('Test 2: Testing getZiinaOAuthStatus...');
const statusInitial = getZiinaOAuthStatus('octapusthredoo.vercel.app');
console.log('Initial Status:', statusInitial);
assert.strictEqual(statusInitial.clientId, 'test');
assert(statusInitial.redirectUri.includes('/api/ziina/oauth/callback'));
assert.strictEqual(statusInitial.hasStaticApiKey, true);
console.log('✓ Test 2 passed: Status endpoint returns accurate metadata.\n');

// Test 3: OAuth Callback Error Handling
console.log('Test 3: Testing handleZiinaOAuthCallback with user cancellation / error...');
const errorRes = await handleZiinaOAuthCallback({
  error: 'access_denied',
  error_description: 'The user declined permission to access their Ziina wallet.'
}, 'octapusthredoo.vercel.app');

assert.strictEqual(errorRes.success, false);
assert.strictEqual(errorRes.code, 'access_denied');
console.log('✓ Test 3 passed: Callback error handling is robust.\n');

// Test 4: OAuth Callback Missing Code Handling
console.log('Test 4: Testing handleZiinaOAuthCallback with missing authorization code...');
const missingRes = await handleZiinaOAuthCallback({}, 'octapusthredoo.vercel.app');
assert.strictEqual(missingRes.success, false);
assert(missingRes.error.includes('Missing authorization code'));
console.log('✓ Test 4 passed: Missing code handled gracefully.\n');

// Test 5: HTML Callback Renderer
console.log('Test 5: Testing renderOAuthCallbackHtml...');
const successHtml = renderOAuthCallbackHtml({ success: true, account: { name: 'Thredo Fashion Studio' } }, 'https://octapusthredoo.vercel.app');
assert(successHtml.includes('Ziina Wallet Connected'), 'Must have success title');
assert(successHtml.includes('Thredo Fashion Studio'), 'Must display account name');
assert(successHtml.includes('ziina_oauth_result'), 'Must notify parent opener');

const failureHtml = renderOAuthCallbackHtml({ success: false, error: 'Invalid client credentials' }, 'https://octapusthredoo.vercel.app');
assert(failureHtml.includes('Ziina Connection Notice'), 'Must display notice');
assert(failureHtml.includes('Invalid client credentials'), 'Must render error');
console.log('✓ Test 5 passed: HTML callback views render with pristine branding.\n');

// Test 6: Effective Token Resolution
console.log('Test 6: Testing getEffectiveZiinaToken fallback...');
const tokenInfo = getEffectiveZiinaToken();
assert.strictEqual(tokenInfo.source, 'static_api_key');
assert(tokenInfo.token.length > 0, 'Must fall back to static API key');
console.log('✓ Test 6 passed: Seamless fallback to static API key when OAuth is not connected.\n');

// Test 7: Disconnect Handler Security
console.log('Test 7: Testing handleZiinaOAuthDisconnect authorization...');
const badAuth = handleZiinaOAuthDisconnect('wrong_key');
assert.strictEqual(badAuth.status, 401);
const goodAuth = handleZiinaOAuthDisconnect('admin12345');
assert.strictEqual(goodAuth.status, 200);
console.log('✓ Test 7 passed: Disconnect route protected with admin key.\n');

// Test 8: Paywall Config includes OAuth metadata
console.log('Test 8: Testing getPaywallConfig metadata...');
const cfg = getPaywallConfig('octapusthredoo.vercel.app');
assert('oauthConnected' in cfg, 'Config must report oauthConnected');
assert('authSource' in cfg, 'Config must report authSource');
console.log('✓ Test 8 passed: Paywall config updated with OAuth telemetry.\n');

console.log('🎉 All 8/8 Ziina OIDC OAuth tests PASSED successfully!');
