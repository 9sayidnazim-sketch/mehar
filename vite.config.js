import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'
import { defineConfig } from 'vite'
import { jsPDF } from 'jspdf'
import { checkOrbitStatus, sendOrbitMediaDocument } from './base44/shared/whatsapp.js'

function getOrbitConfig() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        let v = trimmed.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        env[k] = v;
      }
    }
  }
  return {
    apiUrl: env.ORBIT_API_URL || process.env.ORBIT_API_URL || 'https://orbit-35-154-242-129.sslip.io',
    instanceToken: env.ORBIT_INSTANCE_TOKEN || process.env.ORBIT_INSTANCE_TOKEN || '98fbdc66-d18e-423b-a7bc-8e308fd00277',
    instanceId: env.ORBIT_INSTANCE_ID || process.env.ORBIT_INSTANCE_ID || '3301b765-5512-404d-b597-8563b1d263d8',
    senderNumber: env.ORBIT_SENDER_NUMBER || process.env.ORBIT_SENDER_NUMBER || '+639562441681'
  };
}

function generateDevInvoicePdf(sale) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margin = 14, right = W - margin, bottom = H - 24;

  doc.setFillColor(91, 61, 245);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('THREDO Tailoring & POS', margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Al Wasl Road, Al Satwa, Dubai  •  TRN: 100234857200003', margin, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SALE INVOICE', right, 13, { align: 'right' });

  doc.setTextColor(33, 33, 40);
  let y = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${sale.sale_id || sale.id || 'INV-0001'}`, margin, y);
  doc.text(`Date: ${sale.date || new Date().toISOString().slice(0, 10)}`, right, y, { align: 'right' });
  y += 7;

  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y - 4, W - margin * 2, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text('CUSTOMER', margin + 4, y);
  doc.setTextColor(33, 33, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(sale.customer_name || 'Walk-in Customer', margin + 4, y + 5);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  if (sale.customer_phone) doc.text(`Phone: ${sale.customer_phone}`, margin + 4, y + 9);
  y += 16;

  doc.setTextColor(255, 255, 255);
  doc.setFillColor(91, 61, 245);
  doc.rect(margin, y - 4, W - margin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('#', margin + 2, y);
  doc.text('Item', margin + 14, y);
  doc.text('Qty', margin + 110, y);
  doc.text('Price', margin + 130, y);
  doc.text('Total', right - 2, y, { align: 'right' });
  doc.setTextColor(33, 33, 40);
  y += 5;

  const items = sale.items && sale.items.length > 0 ? sale.items : [{ name: 'Custom Tailoring & Fabrics', quantity: 1, price: Number(sale.total || 0), line_total: Number(sale.total || 0) }];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  items.forEach((it, i) => {
    if (y > bottom) { doc.addPage(); y = 36; }
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 4, W - margin * 2, 6, 'F');
    }
    doc.text(String(i + 1), margin + 2, y);
    doc.text(String(it.name || '—'), margin + 14, y);
    doc.text(String(it.quantity || 0), margin + 110, y);
    doc.text(`AED ${Number(it.price || 0).toFixed(2)}`, margin + 130, y);
    doc.text(`AED ${Number(it.line_total || it.price * it.quantity || 0).toFixed(2)}`, right - 2, y, { align: 'right' });
    y += 6;
  });

  y += 3;
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, y, right, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total', margin, y);
  doc.text(`AED ${Number(sale.total || 0).toFixed(2)}`, right, y, { align: 'right' });
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('Amount Paid', margin, y);
  doc.text(`AED ${Number(sale.amount_paid || sale.total || 0).toFixed(2)}`, right, y, { align: 'right' });
  y += 6;
  doc.setTextColor(217, 119, 6);
  doc.text('Balance Due', margin, y);
  doc.text(`AED ${Number(sale.balance_due || 0).toFixed(2)}`, right, y, { align: 'right' });

  doc.setDrawColor(220, 220, 225);
  doc.line(margin, H - 20, right, H - 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text('Thank you for choosing THREDO.', margin, H - 14);
  doc.text('This is an official system-generated invoice.', margin, H - 10);

  return doc.output('arraybuffer');
}

function generateDevOrderInvoicePdf(payment, order, customer) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margin = 15, right = W - margin;
  let y = 20;

  // Header band
  doc.setFillColor(91, 61, 245);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('THREDO Tailoring & Design', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Al Wasl Road, Al Satwa, Dubai  •  TRN: 100234857200003', margin, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('INVOICE', right, 16, { align: 'right' });

  doc.setTextColor(33, 33, 40);
  y = 38;
  const orderRef = (order && order.order_id) || payment?.order_ref || payment?.id?.slice(-6) || 'INV-001';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${orderRef}`, margin, y);
  doc.text(`Date: ${payment?.date || new Date().toISOString().slice(0, 10)}`, right, y, { align: 'right' });
  y += 8;

  // Bill To
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(margin, y - 4, W - margin * 2, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text('BILL TO', margin + 4, y);
  doc.setTextColor(33, 33, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const custName = (customer && customer.name) || order?.customer_name || payment?.customer_name || 'Customer';
  doc.text(custName, margin + 4, y + 5);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  const custPhone = (customer && customer.phone) || order?.customer_phone;
  if (custPhone) doc.text(`Phone: ${custPhone}`, margin + 4, y + 9);
  y += 18;

  // Order details
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(33, 33, 40);
  doc.text('Order Details', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const detailRows = [
    ['Order Type', order?.order_type || 'Custom Tailoring'],
    ['Status', order?.status || 'Processing'],
    ['Delivery Date', order?.delivery_date || '—'],
    ['Tailor', order?.tailor_name || 'Assigned Tailor'],
  ];
  detailRows.forEach(([k, v]) => {
    doc.setTextColor(120, 120, 130);
    doc.text(String(k), margin, y);
    doc.setTextColor(33, 33, 40);
    doc.text(String(v), margin + 50, y);
    y += 6;
  });

  // Pricing
  y += 4;
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Payment Summary', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const money = (n) => `AED ${Number(n || 0).toFixed(2)}`;

  doc.setTextColor(120, 120, 130);
  doc.text('Total Amount', margin, y);
  doc.setTextColor(33, 33, 40);
  doc.text(money(order?.total_amount || payment?.amount || 0), right, y, { align: 'right' });
  y += 7;
  doc.setTextColor(16, 185, 129);
  doc.text(`Amount Paid (${payment?.type || 'Payment'})`, margin, y);
  doc.text(money(payment?.amount || order?.total_amount || 0), right, y, { align: 'right' });
  y += 7;
  doc.setTextColor(245, 158, 11);
  doc.text('Balance Due', margin, y);
  doc.text(money(order?.balance_due || 0), right, y, { align: 'right' });
  y += 12;

  // Footer
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, H - 20, right, H - 20);
  doc.setTextColor(120, 120, 130);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for choosing THREDO.', margin, H - 14);
  doc.text('This is an official system-generated invoice.', margin, H - 10);

  return doc.output('arraybuffer');
}

let devEntityStore = null;
function getDevEntities() {
  if (devEntityStore) return devEntityStore;
  try {
    const seedPath = path.resolve(process.cwd(), 'src/api/seedData.json');
    if (fs.existsSync(seedPath)) {
      devEntityStore = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch (_) {}
  if (!devEntityStore) devEntityStore = {};
  return devEntityStore;
}

function localDevApiPlugin() {
  return {
    name: 'local-dev-api-mock',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Set standard CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const rawUrl = req.url || '';
        const url = rawUrl.split('?')[0];

        if (url.startsWith('/api') || url.startsWith('/functions') || url.startsWith('/apps') || url.includes('Sale') || url.includes('Invoice') || url.includes('whatsapp')) {
          console.log(`[DevServer API] ${req.method} ${url}`);
        }

        // Handle auth login
        if (url.includes('/auth/login') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            let email = 'gm@octapus.ae';
            try {
              const parsed = JSON.parse(body);
              if (parsed.email) email = parsed.email;
            } catch (e) {}

            const isAdmin = email.toLowerCase().includes('octapus') || 
                            email.toLowerCase().includes('admin') || 
                            email.toLowerCase() === 'gm@octapus.ae';

            const user = {
              id: 'usr-admin-gm',
              email: email,
              full_name: 'General Manager',
              role: isAdmin ? 'admin' : 'user',
              business_id: 'biz-default'
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              access_token: 'local-dev-token-gm',
              user
            }));
          });
          return;
        }

        // Handle auth register
        if (url.includes('/auth/register') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            let email = '';
            try {
              const parsed = JSON.parse(body);
              if (parsed.email) email = parsed.email;
            } catch (e) {}

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              message: 'Verification code sent to ' + email,
              email
            }));
          });
          return;
        }

        // Handle auth verify OTP
        if (url.includes('/auth/verify-otp') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            let email = 'user@example.com';
            try {
              const parsed = JSON.parse(body);
              if (parsed.email) email = parsed.email;
            } catch (e) {}

            const isAdmin = email.toLowerCase().includes('octapus') || 
                            email.toLowerCase().includes('admin') || 
                            email.toLowerCase() === 'gm@octapus.ae';

            const user = {
              id: 'usr_' + Date.now(),
              email: email,
              full_name: email.split('@')[0],
              role: isAdmin ? 'admin' : 'user',
              business_id: 'biz-default'
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              access_token: 'local-dev-token-' + Date.now(),
              user
            }));
          });
          return;
        }

        // Handle auth resend OTP
        if (url.includes('/auth/resend-otp') && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: 'OTP resent successfully'
          }));
          return;
        }

        // Handle auth reset password request
        if (url.includes('/auth/reset-password-request') && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: 'Password reset link sent'
          }));
          return;
        }

        // Handle auth reset password
        if (url.includes('/auth/reset-password') && req.method === 'POST') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: 'Password updated successfully'
          }));
          return;
        }

        // Handle Google OAuth provider endpoint
        if (url.includes('/apps/auth/login') || url.includes('/auth/google')) {
          let fromUrl = '/';
          try {
            const reqUrl = new URL(req.url, 'http://localhost:5173');
            fromUrl = reqUrl.searchParams.get('from_url') || '/';
          } catch (e) {}

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Authenticating with Google...</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc;">
  <div style="text-align: center; max-width: 340px; padding: 24px; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
    <div style="width: 44px; height: 44px; margin: 0 auto 16px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 600;">Signed in with Google</h3>
    <p style="margin: 0; font-size: 13px; color: #94a3b8;">Connecting to <strong style="color: #60a5fa;">gm@octapus.ae</strong>...</p>
  </div>
  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  <script>
    const user = {
      id: 'usr_google_gm',
      email: 'gm@octapus.ae',
      full_name: 'General Manager',
      role: 'admin',
      auth_provider: 'google',
      business_id: 'biz-default'
    };
    localStorage.setItem('thredo_user', JSON.stringify(user));
    localStorage.setItem('base44_access_token', 'google-token-' + Date.now());
    setTimeout(() => {
      window.location.href = ${JSON.stringify(fromUrl)};
    }, 500);
  </script>
</body>
</html>`);
          return;
        }

        // Handle auth me
        if (url.includes('/auth/me')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            id: 'usr-admin-gm',
            email: 'gm@octapus.ae',
            full_name: 'General Manager',
            role: 'admin',
            business_id: 'biz-default'
          }));
          return;
        }

        // Handle functions getAccessState
        if (url.includes('/api/functions/getAccessState') || url.includes('/functions/getAccessState')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            data: {
              access: {
                state: 'admin',
                allowed: true,
                badge: 'Admin',
                badgeVariant: 'admin',
                role: 'admin',
                business_id: 'biz-default',
                expires_at: null,
                expires_formatted: 'Permanent (Platform Admin)',
                plan: 'System Admin'
              }
            },
            access: {
              state: 'admin',
              allowed: true,
              badge: 'Admin',
              badgeVariant: 'admin',
              role: 'admin',
              business_id: 'biz-default',
              expires_at: null,
              expires_formatted: 'Permanent (Platform Admin)',
              plan: 'System Admin'
            }
          }));
          return;
        }

        // Handle functions getNotifications
        if (url.includes('/functions/getNotifications')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            data: { notifications: [], unread_count: 0 },
            notifications: [],
            unread_count: 0
          }));
          return;
        }

        // Handle functions getOnlineOrderingConfig
        if (url.includes('/functions/getOnlineOrderingConfig')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            data: { enabled: true, paused: false, business_id: 'biz-default' }
          }));
          return;
        }

        // Handle functions sendSaleBill (Orbit WhatsApp gateway for retail sales)
        if (url.includes('sendSaleBill') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            let body = {};
            try { body = JSON.parse(bodyStr); } catch (_) {}

            const invoiceId = body.invoice_id || body.sale_id || body.id || (body.sale_draft && (body.sale_draft.sale_id || body.sale_draft.id)) || 'INV-DRAFT';

            // Load seedData or local sales
            let sale = null;
            try {
              const seedPath = path.resolve(process.cwd(), 'src/api/seedData.json');
              if (fs.existsSync(seedPath)) {
                const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
                sale = seed.Sale?.find(s => s.id === invoiceId || s.sale_id === invoiceId);
              }
            } catch (_) {}

            if (!sale && body.sale_draft) {
              sale = body.sale_draft;
            }
            if (!sale) {
              sale = {
                id: invoiceId,
                sale_id: invoiceId,
                customer_name: body.customer_name || 'Customer',
                customer_phone: body.phone || '+971501234567',
                total: body.total || 0,
                amount_paid: body.total || 0,
                balance_due: 0,
                date: new Date().toISOString().slice(0, 10),
                payment_method: 'Cash',
                payment_status: 'Paid',
                items: []
              };
            }

            // Check Idempotency (Requirement 8)
            if (!body.force_retry && (sale.whatsapp_status === 'Submitted' || sale.whatsapp_status === 'Delivered' || sale.whatsapp_status === 'sent')) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                already_submitted: true,
                status: sale.whatsapp_status,
                recipient: sale.whatsapp_recipient || sale.sent_to_number,
                invoice_id: sale.sale_id || sale.id,
                message_id: sale.whatsapp_message_id,
                timestamp: sale.whatsapp_timestamp,
                message: `Invoice already ${sale.whatsapp_status} to ${sale.whatsapp_recipient || sale.sent_to_number}`
              }));
              return;
            }

            // Recipient number validation (Requirement 5)
            const recipientPhone = body.phone || sale.customer_phone || (body.sale_draft && body.sale_draft.customer_phone) || '';
            const cleanNumber = String(recipientPhone).replace(/\D/g, '');
            if (cleanNumber.length < 8 || cleanNumber.length > 15) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Invalid recipient phone number. Must include country code and contain 8 to 15 digits.'
              }));
              return;
            }

            // Orbit config & status check (Requirement 6)
            const { apiUrl, instanceToken } = getOrbitConfig();
            const statusCheck = await checkOrbitStatus({ apiUrl, apiKey: instanceToken });
            if (!statusCheck.ok) {
              if (body.dev_simulate || process.env.DEV_MOCK_WHATSAPP === 'true') {
                const invoiceNo = sale.sale_id || invoiceId;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  simulated: true,
                  status: 'Submitted',
                  invoice_id: invoiceNo,
                  recipient: cleanNumber,
                  message_id: 'sim_orbit_' + Date.now(),
                  timestamp: new Date().toISOString(),
                  message: `Dev Mode: Simulated WhatsApp invoice sent to +${cleanNumber}`
                }));
                return;
              }

              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Orbit WhatsApp instance is not connected or logged in.',
                not_logged_in: true,
                qr_available: true,
                details: statusCheck.details || statusCheck.error
              }));
              return;
            }

            // Generate invoice PDF server-side (Requirement 4)
            const pdfBytes = generateDevInvoicePdf(sale);
            const invoiceNo = sale.sale_id || invoiceId;
            const fileName = `invoice-${invoiceNo}.pdf`;
            const custName = sale.customer_name || 'Customer';
            const caption = `Hello ${custName}, here is your invoice ${invoiceNo}. Thank you.`;

            // Send via POST /send/media as multipart/form-data (Requirement 7)
            const orbitRes = await sendOrbitMediaDocument({
              apiUrl,
              apiKey: instanceToken,
              to: cleanNumber,
              pdfBytes,
              fileName,
              caption,
              timeoutMs: 15000
            });

            // Handle timeout (Requirement 10)
            if (orbitRes.timed_out) {
              res.statusCode = 504;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                timed_out: true,
                error: 'Result unknown—check before retrying',
                invoice_id: invoiceNo,
                recipient: cleanNumber
              }));
              return;
            }

            if (!orbitRes.ok) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: orbitRes.error || 'Failed to dispatch invoice via Orbit WhatsApp',
                details: orbitRes.details
              }));
              return;
            }

            // Save record with status "Submitted" (Requirement 9)
            const now = new Date().toISOString();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              status: 'Submitted',
              invoice_id: invoiceNo,
              recipient: cleanNumber,
              message_id: orbitRes.message_id,
              timestamp: now
            }));
          });
          return;
        }

        // Handle functions sendWhatsAppInvoice (Orbit WhatsApp gateway for custom orders/payments)
        if (url.includes('sendWhatsAppInvoice') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            let body = {};
            try { body = JSON.parse(bodyStr); } catch (_) {}

            const paymentId = body.payment_id || body.id;
            let payment = body.payment_draft;
            let order = body.order_draft;
            let customer = body.customer_draft;

            // Load seedData if available
            try {
              const seedPath = path.resolve(process.cwd(), 'src/api/seedData.json');
              if (fs.existsSync(seedPath)) {
                const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
                if (!payment && paymentId) {
                  payment = seed.Payment?.find(p => p.id === paymentId);
                }
                const orderId = payment?.order_id || body.order_id;
                if (!order && orderId) {
                  order = seed.Order?.find(o => o.id === orderId);
                }
                const custId = order?.customer_id || payment?.customer_id || body.customer_id;
                if (!customer && custId) {
                  customer = seed.Customer?.find(c => c.id === custId);
                }
              }
            } catch (_) {}

            if (!payment) {
              payment = {
                id: paymentId || 'PAY-' + Date.now(),
                amount: body.amount || (order && order.total_amount) || 0,
                order_id: body.order_id,
                order_ref: body.order_ref,
                date: new Date().toISOString().slice(0, 10),
                type: 'payment'
              };
            }

            if (payment.type === 'refund') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ skipped: true, reason: 'refund — no invoice sent' }));
              return;
            }

            const rawNumber = body.phone || (customer && (customer.whatsapp || customer.phone)) || (order && order.customer_phone) || '';
            const cleanNumber = String(rawNumber).replace(/\D/g, '');
            if (cleanNumber.length < 8 || cleanNumber.length > 15) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Invalid recipient phone number. Must include country code and contain 8 to 15 digits.'
              }));
              return;
            }

            const { apiUrl, instanceToken } = getOrbitConfig();
            const statusCheck = await checkOrbitStatus({ apiUrl, apiKey: instanceToken });
            if (!statusCheck.ok) {
              if (body.dev_simulate || process.env.DEV_MOCK_WHATSAPP === 'true') {
                const orderRef = (order && order.order_id) || body.order_ref || payment.order_ref || (paymentId ? String(paymentId).slice(-6) : 'INV-001');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  simulated: true,
                  status: 'Submitted',
                  invoice_id: orderRef,
                  recipient: cleanNumber,
                  to: cleanNumber,
                  message_id: 'sim_orbit_' + Date.now(),
                  timestamp: new Date().toISOString(),
                  message: `Dev Mode: Simulated WhatsApp invoice sent to +${cleanNumber}`
                }));
                return;
              }

              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Orbit WhatsApp instance is not connected or logged in.',
                not_logged_in: true,
                qr_available: true,
                details: statusCheck.details || statusCheck.error
              }));
              return;
            }

            const orderRef = (order && order.order_id) || body.order_ref || payment.order_ref || (paymentId ? String(paymentId).slice(-6) : 'INV-001');
            const pdfBytes = generateDevOrderInvoicePdf(payment, order, customer);
            const fileName = `invoice-${orderRef}.pdf`;
            const custName = (customer && customer.name) || (order && order.customer_name) || 'Customer';
            const money = (n) => `AED ${Number(n || 0).toFixed(2)}`;
            const captionLines = [
              `Thank you for your order with THREDO!`,
              `Invoice: ${orderRef}`,
              `Amount Paid: ${money(payment.amount)}`,
            ];
            if (order) {
              captionLines.push(`Total: ${money(order.total_amount)}`);
              captionLines.push(`Balance Due: ${money(order.balance_due)}`);
              if (order.delivery_date) captionLines.push(`Delivery Date: ${order.delivery_date}`);
            }

            const orbitRes = await sendOrbitMediaDocument({
              apiUrl,
              apiKey: instanceToken,
              to: cleanNumber,
              pdfBytes,
              fileName,
              caption: captionLines.join('\n'),
              timeoutMs: 15000
            });

            if (orbitRes.timed_out) {
              res.statusCode = 504;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                timed_out: true,
                error: 'Result unknown—check before retrying',
                order_ref: orderRef,
                to: cleanNumber
              }));
              return;
            }

            if (!orbitRes.ok) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: orbitRes.error || 'Failed to dispatch invoice via Orbit WhatsApp',
                details: orbitRes.details
              }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              status: 'Submitted',
              message_id: orbitRes.message_id,
              to: cleanNumber,
              order_ref: orderRef
            }));
          });
          return;
        }

        // Handle GET /api/whatsapp/qr
        if (url.includes('/api/whatsapp/qr') || url.includes('/whatsapp/qr')) {
          const { apiUrl, instanceToken } = getOrbitConfig();
          const cleanUrl = (apiUrl || 'https://orbit-35-154-242-129.sslip.io').replace(/\/+$/, '');
          const key = instanceToken || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

          fetch(`${cleanUrl}/instance/qr`, {
            method: 'GET',
            headers: { apikey: key }
          }).then(async r => {
            const data = await r.json().catch(() => ({}));
            const st = await checkOrbitStatus({ apiUrl: cleanUrl, apiKey: key }).catch(() => ({}));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              ok: true,
              loggedIn: Boolean(st?.loggedIn),
              connected: Boolean(st?.connected),
              name: st?.name || st?.data?.Name || '',
              qrcode: data?.data?.qrcode || null,
              code: data?.data?.code || null,
              status: st
            }));
          }).catch(err => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: err.message }));
          });
          return;
        }

        // Handle GET /api/whatsapp/status
        if (url.includes('/api/whatsapp/status') || url.includes('/whatsapp/status')) {
          const { apiUrl, instanceToken } = getOrbitConfig();
          checkOrbitStatus({ apiUrl, apiKey: instanceToken }).then(st => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(st));
          }).catch(err => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: err.message }));
          });
          return;
        }

        // Handle mock entities API
        if (url.includes('/entities/')) {
          const match = url.match(/\/entities\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
          const entityName = match ? match[1] : '';
          const recordId = match ? match[2] : null;
          const store = getDevEntities();
          if (!store[entityName]) store[entityName] = [];

          if (req.method === 'GET') {
            if (recordId) {
              const item = store[entityName].find(i => String(i.id) === String(recordId) || String(i.order_id) === String(recordId)) || null;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(item));
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(store[entityName]));
            return;
          }
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              let body = {};
              try { body = JSON.parse(bodyStr); } catch (_) {}
              const newItem = {
                id: (entityName ? entityName.toLowerCase() : 'item') + '_' + Date.now(),
                created_date: new Date().toISOString(),
                ...body
              };
              store[entityName].unshift(newItem);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(newItem));
            });
            return;
          }
          if (req.method === 'PUT' || req.method === 'PATCH') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              let body = {};
              try { body = JSON.parse(bodyStr); } catch (_) {}
              if (recordId) {
                const idx = store[entityName].findIndex(i => String(i.id) === String(recordId) || String(i.order_id) === String(recordId));
                if (idx !== -1) {
                  store[entityName][idx] = { ...store[entityName][idx], ...body };
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(store[entityName][idx]));
                  return;
                }
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ id: recordId, ...body }));
            });
            return;
          }
          if (req.method === 'DELETE') {
            if (recordId) {
              store[entityName] = store[entityName].filter(i => String(i.id) !== String(recordId) && String(i.order_id) !== String(recordId));
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
            return;
          }
        }

        // Catch-all for any other functions or APIs to prevent 404 in local dev
        if (url.startsWith('/api/') || url.startsWith('/functions/') || url.includes('/functions/')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, data: {} }));
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    server: {
      host: '0.0.0.0',
      port: 5173,
      cors: true
    },
    plugins: [
      localDevApiPlugin(),
      base44({
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: false,
        navigationNotifier: false,
        analyticsTracker: false,
        visualEditAgent: false
      }),
      react(),
    ]
  };
});

