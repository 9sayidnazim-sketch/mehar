// Universal Vercel Serverless Function Handler for THREDO
import {
  checkOrbitInstanceStatus,
  handleSendInvoiceRequest,
  handleOrbitWebhook,
  getInvoiceFromDb,
  getInvoiceSendRecords,
  syncInvoiceToDb
} from '../../server/whatsappBackend.js';

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
  
  // Resolve path from query action, pathname, or x-matched-path
  const actionParam = req.query?.action;
  const action = Array.isArray(actionParam) ? actionParam.join('/') : (actionParam || '');
  const pathname = reqUrl.pathname;
  const matchedPath = req.headers['x-matched-path'] || '';

  const isStatus = action === 'whatsapp-status' || pathname.endsWith('/whatsapp-status') || matchedPath.endsWith('/whatsapp-status');
  const isHistory = action === 'whatsapp-history' || pathname.endsWith('/whatsapp-history') || matchedPath.endsWith('/whatsapp-history');
  const isSend = action === 'send-whatsapp' || pathname.endsWith('/send-whatsapp') || matchedPath.endsWith('/send-whatsapp');
  const isWebhook = action === 'webhook' || pathname.endsWith('/webhook') || matchedPath.endsWith('/webhook');
  const isSync = action === 'sync' || pathname.endsWith('/sync') || matchedPath.endsWith('/sync');
  const isHealth = action === 'health' || pathname.endsWith('/health') || matchedPath.endsWith('/health');

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
    error: `Endpoint not found: ${pathname}`,
    action,
    matchedPath
  });
}
