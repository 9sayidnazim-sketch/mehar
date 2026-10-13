// Vite Plugin providing protected server-side WhatsApp endpoints for Thredo

import {
  checkOrbitInstanceStatus,
  handleSendInvoiceRequest,
  handleOrbitWebhook,
  getInvoiceFromDb,
  syncInvoiceToDb,
  getInvoiceSendRecords
} from './whatsappBackend.js';

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
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export function whatsappVitePlugin(env = {}) {
  // Populate process.env from local environment file safely on the server side
  if (env.ORBIT_API_URL) process.env.ORBIT_API_URL = env.ORBIT_API_URL;
  if (env.ORBIT_INSTANCE_TOKEN) process.env.ORBIT_INSTANCE_TOKEN = env.ORBIT_INSTANCE_TOKEN;
  if (env.ORBIT_INSTANCE_ID) process.env.ORBIT_INSTANCE_ID = env.ORBIT_INSTANCE_ID;
  if (env.ORBIT_SENDER_NUMBER) process.env.ORBIT_SENDER_NUMBER = env.ORBIT_SENDER_NUMBER;

  return {
    name: 'thredo-whatsapp-api',
    configureServer(server) {
      // 1. Instance Status Check: GET /api/invoices/whatsapp-status
      server.middlewares.use('/api/invoices/whatsapp-status', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const status = await checkOrbitInstanceStatus();
          return sendJson(res, 200, status);
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      });

      // 2. Dispatch History Check: GET /api/invoices/whatsapp-history
      server.middlewares.use('/api/invoices/whatsapp-history', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const invoiceId = url.searchParams.get('invoice_id');
          const records = getInvoiceSendRecords(invoiceId);
          return sendJson(res, 200, { records });
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      });

      // 3. Protected Send Invoice: POST /api/invoices/send-whatsapp
      server.middlewares.use('/api/invoices/send-whatsapp', async (req, res, next) => {
        if (req.method !== 'POST') return next();
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

          // Sync incoming invoice if provided to ensure persistent store has latest data
          if (invoice_data && invoice_data.id) {
            syncInvoiceToDb(invoice_data);
          }

          // Mock user session or verify bearer auth header
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
              // Lookup from persistent DB
              const fromDb = getInvoiceFromDb(id);
              if (fromDb.sale) return fromDb;

              // Fallback to synced data if provided in request
              if (invoice_data && (invoice_data.id === id || invoice_data.sale_id === id)) {
                return {
                  sale: invoice_data,
                  customer: null,
                  company: null
                };
              }
              return { sale: null, customer: null, company: null };
            }
          });

          return sendJson(res, result.status, result.body);
        } catch (err) {
          console.error('[WhatsApp API] Error processing send request:', err);
          return sendJson(res, 500, { error: err.message });
        }
      });

      // 3. Webhook Receiver: POST /api/invoices/webhook
      server.middlewares.use('/api/invoices/webhook', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const body = await readJsonBody(req);
          const result = await handleOrbitWebhook(body);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      });

      // 4. Client-to-Server DB Sync: POST /api/invoices/sync
      server.middlewares.use('/api/invoices/sync', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const body = await readJsonBody(req);
          const { sale, customer } = body;
          if (sale) {
            syncInvoiceToDb(sale, customer);
          }
          return sendJson(res, 200, { ok: true });
        } catch (err) {
          return sendJson(res, 500, { error: err.message });
        }
      });
    }
  };
}
