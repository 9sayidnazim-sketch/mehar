import {
  checkOrbitInstanceStatus,
  handleSendInvoiceRequest,
  handleOrbitWebhook,
  getInvoiceFromDb,
  getInvoiceSendRecords,
  syncInvoiceToDb
} from '../../server/whatsappBackend.js';
import {
  getPaywallConfig,
  handleCheckout,
  handleVerify,
  handleCouponRedeem,
  getLicenseStatus,
  handleAdminCreateCoupons,
  handleAdminListCoupons,
  getZiinaOAuthAuthorizeUrl,
  handleZiinaOAuthCallback,
  getZiinaOAuthStatus,
  handleZiinaOAuthDisconnect,
  renderOAuthCallbackHtml
} from '../../server/paywallBackend.js';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(jsonStr);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  const host = req.headers.host || 'localhost';
  const reqUrl = new URL(req.url, `https://${host}`);
  
  // Resolve path from query action, path, url pathname, or headers
  const queryParam = req.query?.action || req.query?.path || req.query?.match || '';
  const queryString = Array.isArray(queryParam) ? queryParam.join('/') : String(queryParam);
  const matchedPath = String(req.headers['x-matched-path'] || req.headers['x-now-route-matches'] || '');
  const rawPath = `${queryString} ${reqUrl.pathname} ${matchedPath}`.toLowerCase();

  const isHealth = rawPath.includes('health');
  const isStatus = rawPath.includes('whatsapp-status');
  const isHistory = rawPath.includes('whatsapp-history');
  const isSend = rawPath.includes('send-whatsapp');
  const isWebhook = rawPath.includes('webhook');
  const isSync = rawPath.includes('sync');

  // Paywall endpoints
  const isConfig = rawPath.includes('config');
  const isCheckout = rawPath.includes('checkout');
  const isVerify = rawPath.includes('verify');
  const isCouponRedeem = rawPath.includes('coupon/redeem') || rawPath.includes('redeem');
  const isAccess = rawPath.includes('access');
  const isAdminCoupons = rawPath.includes('admin/coupons') || rawPath.includes('coupons');

  // Ziina OAuth 2.0 / OIDC endpoints
  const isZiinaAuth = rawPath.includes('ziina') && (rawPath.includes('auth') || rawPath.includes('authorize'));
  const isZiinaCallback = rawPath.includes('ziina') && rawPath.includes('callback');
  const isZiinaStatus = rawPath.includes('ziina') && rawPath.includes('status');
  const isZiinaDisconnect = rawPath.includes('ziina') && rawPath.includes('disconnect');

  // GET /api/ziina/oauth/authorize
  if (isZiinaAuth && req.method === 'GET') {
    const overrideState = reqUrl.searchParams.get('state') || req.query?.state;
    const overrideRedirectUri = reqUrl.searchParams.get('redirect_uri') || req.query?.redirect_uri;
    const authData = getZiinaOAuthAuthorizeUrl(host, overrideState, overrideRedirectUri);

    const wantsJson = reqUrl.searchParams.get('json') === '1' ||
                      req.query?.json === '1' ||
                      req.headers.accept?.includes('application/json');

    if (wantsJson) {
      return sendJson(res, 200, authData);
    }

    res.writeHead(302, { Location: authData.authorizeUrl });
    return res.end();
  }

  // GET /api/ziina/oauth/callback
  if (isZiinaCallback && req.method === 'GET') {
    try {
      const queryParams = Object.fromEntries(reqUrl.searchParams.entries());
      if (req.query && typeof req.query === 'object') {
        Object.assign(queryParams, req.query);
      }
      const result = await handleZiinaOAuthCallback(queryParams, host);
      const wantsJson = reqUrl.searchParams.get('format') === 'json' ||
                        req.headers.accept?.includes('application/json');

      if (wantsJson) {
        return sendJson(res, result.success ? 200 : 400, result);
      }

      const html = renderOAuthCallbackHtml(result, `https://${host}`);
      res.writeHead(result.success ? 200 : 400, {
        'Content-Type': 'text/html; charset=utf-8'
      });
      return res.end(html);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // GET /api/ziina/oauth/status
  if (isZiinaStatus && req.method === 'GET') {
    return sendJson(res, 200, getZiinaOAuthStatus(host));
  }

  // POST /api/ziina/oauth/disconnect
  if (isZiinaDisconnect && req.method === 'POST') {
    const adminKey = req.headers['x-admin-key'] || req.headers['admin-key'] || '';
    const result = handleZiinaOAuthDisconnect(adminKey);
    return sendJson(res, result.status, result.body);
  }

  if (isConfig && req.method === 'GET') {
    return sendJson(res, 200, getPaywallConfig(host));
  }

  if (isCheckout && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleCheckout(body, host);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isVerify && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleVerify(body);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isCouponRedeem && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = handleCouponRedeem(body);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isAccess && req.method === 'GET') {
    const tokenStr = reqUrl.searchParams.get('token') || req.query?.token || '';
    return sendJson(res, 200, getLicenseStatus(tokenStr));
  }

  if (isAdminCoupons) {
    const adminKey = req.headers['x-admin-key'] || req.headers['admin-key'] || '';
    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const result = handleAdminCreateCoupons(body, adminKey);
        return sendJson(res, result.status, result.body);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }
    if (req.method === 'GET') {
      const result = handleAdminListCoupons(adminKey);
      return sendJson(res, result.status, result.body);
    }
  }

  if (isHealth) {
    return sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString(), platform: 'vercel' });
  }

  if (isStatus && req.method === 'GET') {
    try {
      const status = await checkOrbitInstanceStatus();
      return sendJson(res, 200, status);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isHistory && req.method === 'GET') {
    try {
      const invoiceId = reqUrl.searchParams.get('invoice_id') || req.query?.invoice_id;
      const records = getInvoiceSendRecords(invoiceId);
      return sendJson(res, 200, { records });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isSend && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const {
        invoice_id,
        idempotency_key,
        preview_recipient,
        allow_resend,
        confirm_resend,
        invoice_data
      } = body;

      if (invoice_data && invoice_data.id) {
        syncInvoiceToDb(invoice_data);
      }

      const user = {
        id: 'usr-admin-1',
        name: 'Alex / CEO Octapus',
        email: 'admin@octapus.ae',
        role: 'admin'
      };

      const result = await handleSendInvoiceRequest({
        invoiceId: invoice_id,
        idempotencyKey: idempotency_key,
        previewRecipient: preview_recipient,
        allowResend: Boolean(allow_resend || confirm_resend),
        user,
        getInvoiceFn: async (id) => {
          const fromDb = getInvoiceFromDb(id);
          if (fromDb.sale) return fromDb;
          if (invoice_data && (invoice_data.id === id || invoice_data.sale_id === id)) {
            return { sale: invoice_data, customer: null, company: null };
          }
          return { sale: null, customer: null, company: null };
        }
      });

      return sendJson(res, result.status, result.body);
    } catch (err) {
      console.error('[Vercel API Error] send-whatsapp failed:', err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isWebhook && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleOrbitWebhook(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (isSync && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { sale, customer } = body;
      if (sale) syncInvoiceToDb(sale, customer);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return sendJson(res, 404, {
    error: `Endpoint not found: ${reqUrl.pathname}`,
    path: queryString,
    matchedPath
  });
}
