// Production HTTP Server for THREDO on AWS (App Runner, ECS, EC2, Lightsail)
// Serves static production assets from dist/ with SPA fallback and provides protected WhatsApp API endpoints.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkOrbitInstanceStatus,
  handleSendInvoiceRequest,
  handleOrbitWebhook,
  getInvoiceFromDb,
  getInvoiceSendRecords,
  syncInvoiceToDb
} from './whatsappBackend.js';
import {
  getPaywallConfig,
  handleCheckout,
  handleVerify,
  handleCouponRedeem,
  getLicenseStatus,
  handleAdminCreateCoupons,
  handleAdminListCoupons
} from './paywallBackend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
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
    'Content-Length': Buffer.byteLength(jsonStr),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(jsonStr);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Health check endpoint for AWS ALB / App Runner / ECS
  if (pathname === '/health' || pathname === '/api/health') {
    return sendJson(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
  }

  // Paywall API Route: GET /api/config
  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, getPaywallConfig(req.headers.host));
  }

  // Paywall API Route: POST /api/checkout
  if (pathname === '/api/checkout' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleCheckout(body, req.headers.host);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Paywall API Route: POST /api/verify
  if (pathname === '/api/verify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleVerify(body);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Paywall API Route: POST /api/coupon/redeem
  if (pathname === '/api/coupon/redeem' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = handleCouponRedeem(body);
      return sendJson(res, result.status, result.body);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Paywall API Route: GET /api/access
  if (pathname === '/api/access' && req.method === 'GET') {
    const tokenStr = reqUrl.searchParams.get('token') || '';
    return sendJson(res, 200, getLicenseStatus(tokenStr));
  }

  // Paywall API Route: /api/admin/coupons
  if (pathname === '/api/admin/coupons') {
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

  // API Route: GET /api/invoices/whatsapp-status
  if (pathname === '/api/invoices/whatsapp-status' && req.method === 'GET') {
    try {
      const status = await checkOrbitInstanceStatus();
      return sendJson(res, 200, status);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // API Route: GET /api/invoices/whatsapp-history
  if (pathname === '/api/invoices/whatsapp-history' && req.method === 'GET') {
    try {
      const invoiceId = reqUrl.searchParams.get('invoice_id');
      const records = getInvoiceSendRecords(invoiceId);
      return sendJson(res, 200, { records });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // API Route: POST /api/invoices/send-whatsapp
  if (pathname === '/api/invoices/send-whatsapp' && req.method === 'POST') {
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
      console.error('[API Error] send-whatsapp failed:', err);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // API Route: POST /api/invoices/webhook
  if (pathname === '/api/invoices/webhook' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await handleOrbitWebhook(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // API Route: POST /api/invoices/sync
  if (pathname === '/api/invoices/sync' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { sale, customer } = body;
      if (sale) syncInvoiceToDb(sale, customer);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // Static File Serving (from dist/)
  if (req.method === 'GET' || req.method === 'HEAD') {
    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';

    const filePath = path.join(DIST_DIR, safePath);

    // If file exists, serve it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isImmutable = safePath.startsWith('/assets/');

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': isImmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
      });

      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(filePath).pipe(res);
    }

    // SPA Fallback: serve index.html for all non-file client routes
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(indexPath).pipe(res);
    }
  }

  // 404 Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 THREDO Production Server running on http://${HOST}:${PORT}`);
  console.log(`📁 Static assets served from: ${DIST_DIR}`);
});
