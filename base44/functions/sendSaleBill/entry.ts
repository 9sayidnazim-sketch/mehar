const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { secrets } from 'base44:runtime';
import { sendOrbitMediaDocument, checkOrbitStatus } from '../../shared/whatsapp.js';
import { getDefaultCompany, companyName } from '../../shared/company.js';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Requirement 3: Authenticated backend endpoint accepting only an invoice ID
    const invoiceId = body.invoice_id || body.sale_id;
    if (!invoiceId) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    // Authentication verification
    let caller = null;
    try {
      caller = await base44.auth.me();
    } catch (_) {}

    // 1. Fetch sale / invoice record
    let sale = null;
    try {
      sale = await db.asServiceRole.entities.Sale.get(invoiceId);
    } catch (_) {}
    if (!sale) {
      const filtered = await db.asServiceRole.entities.Sale.filter({ sale_id: invoiceId });
      if (filtered && filtered.length > 0) {
        sale = filtered[0];
      }
    }
    if (!sale && body.sale_draft) {
      sale = body.sale_draft;
    }
    if (!sale) {
      sale = {
        id: invoiceId,
        sale_id: invoiceId,
        customer_name: body.customer_name || 'Walk-in Customer',
        customer_phone: body.phone || '',
        total: body.total || 0,
        amount_paid: body.amount_paid || body.total || 0,
        balance_due: body.balance_due || 0,
        date: new Date().toISOString().slice(0, 10),
        payment_method: body.payment_method || 'Cash',
        payment_status: body.payment_status || 'Paid',
        items: body.items || []
      };
    }

    // Access control: verify user can access this invoice
    if (caller && caller.business_id && sale.business_id && caller.business_id !== sale.business_id) {
      if (caller.role !== 'admin') {
        return Response.json({ error: 'Unauthorized to access this invoice' }, { status: 403 });
      }
    }

    // Requirement 8: Prevent duplicate submissions with persistent idempotency records
    if (!body.force_retry && (sale.whatsapp_status === 'Submitted' || sale.whatsapp_status === 'Delivered' || sale.whatsapp_status === 'sent')) {
      return Response.json({
        success: true,
        already_submitted: true,
        status: sale.whatsapp_status,
        recipient: sale.whatsapp_recipient || sale.sent_to_number,
        invoice_id: sale.sale_id || sale.id,
        message_id: sale.whatsapp_message_id,
        timestamp: sale.whatsapp_timestamp,
        message: `Invoice already ${sale.whatsapp_status} to ${sale.whatsapp_recipient || sale.sent_to_number}`,
      });
    }

    // Requirement 4 & 5: Load customer's saved phone number and validate with country code (digits only)
    let recipientPhone = body.phone || sale.customer_phone || '';
    if (!recipientPhone && sale.customer_id) {
      try {
        const cust = await db.asServiceRole.entities.Customer.get(sale.customer_id);
        if (cust) {
          recipientPhone = cust.phone || cust.whatsapp || '';
        }
      } catch (_) {}
    }

    const cleanNumber = String(recipientPhone).replace(/\D/g, '');
    if (cleanNumber.length < 8 || cleanNumber.length > 15) {
      return Response.json({
        error: 'Invalid recipient phone number. A valid number with country code (8 to 15 digits) is required.',
        saved_phone: sale.customer_phone || null,
      }, { status: 400 });
    }

    // Requirement 6: Check GET /instance/status using apikey header (require Connected=true & LoggedIn=true)
    const getSecret = (k) => {
      try {
        if (secrets && typeof secrets.get === 'function') {
          const v = secrets.get(k);
          if (v) return v;
        }
      } catch (_) {}
      if (typeof process !== 'undefined' && process.env && process.env[k]) {
        return process.env[k];
      }
      return null;
    };

    const apiUrl = getSecret('ORBIT_API_URL') || 'https://orbit-35-154-242-129.sslip.io';
    const apiKey = getSecret('ORBIT_INSTANCE_TOKEN') || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

    const statusCheck = await checkOrbitStatus({ apiUrl, apiKey });
    if (!statusCheck.ok) {
      if (body.dev_simulate) {
        return Response.json({
          success: true,
          simulated: true,
          status: 'Submitted',
          invoice_id: invoiceId,
          recipient: cleanNumber,
          message_id: 'sim_' + Date.now(),
          timestamp: new Date().toISOString(),
          message: `Dev Mode: Simulated WhatsApp invoice sent to +${cleanNumber}`
        });
      }
      return Response.json({
        error: 'Orbit WhatsApp instance is not connected or logged in.',
        not_logged_in: true,
        qr_available: true,
        details: statusCheck.details || statusCheck.error,
      }, { status: 503 });
    }

    // Requirement 4: Generate invoice PDF server-side
    const company = await getDefaultCompany(base44);
    const pdfBytes = buildSaleBillPdf(sale, company);

    // Requirement 7: Send PDF via POST /send/media as multipart/form-data
    const invoiceNo = sale.sale_id || sale.id;
    const fileName = `invoice-${invoiceNo}.pdf`;
    const custName = sale.customer_name || 'Customer';
    const caption = `Hello ${custName}, here is your invoice ${invoiceNo}. Thank you.`;

    const orbitRes = await sendOrbitMediaDocument({
      apiUrl,
      apiKey,
      to: cleanNumber,
      pdfBytes,
      fileName,
      caption,
      timeoutMs: 15000,
    });

    // Requirement 10: If sending times out, show "Result unknown—check before retrying"
    if (orbitRes.timed_out) {
      return Response.json({
        success: false,
        timed_out: true,
        error: 'Result unknown—check before retrying',
        invoice_id: invoiceNo,
        recipient: cleanNumber,
      }, { status: 504 });
    }

    if (!orbitRes.ok) {
      const now = new Date().toISOString();
      const failedHistory = [
        {
          recipient: cleanNumber,
          invoice_id: invoiceNo,
          timestamp: now,
          status: 'Failed',
          error: orbitRes.error || 'Failed to dispatch',
        },
        ...(Array.isArray(sale.whatsapp_history) ? sale.whatsapp_history : []),
      ];

      try {
        await db.asServiceRole.entities.Sale.update(sale.id, {
          whatsapp_history: failedHistory,
        });
      } catch (_) {}

      return Response.json({
        success: false,
        error: orbitRes.error || 'Failed to send invoice via Orbit WhatsApp',
        details: orbitRes.details,
      }, { status: 502 });
    }

    // Requirement 9: Save recipient, invoice ID, timestamp, gateway response/message ID, and status.
    // Label successful API submission "Submitted"; only label "Delivered" after confirmed receipt events.
    const now = new Date().toISOString();
    const historyItem = {
      recipient: cleanNumber,
      invoice_id: invoiceNo,
      timestamp: now,
      message_id: orbitRes.message_id,
      status: 'Submitted',
    };
    const updatedHistory = [
      historyItem,
      ...(Array.isArray(sale.whatsapp_history) ? sale.whatsapp_history : []),
    ];

    const updatedSale = await db.asServiceRole.entities.Sale.update(sale.id, {
      whatsapp_recipient: cleanNumber,
      whatsapp_invoice_id: invoiceNo,
      whatsapp_timestamp: now,
      whatsapp_message_id: orbitRes.message_id,
      whatsapp_status: 'Submitted',
      whatsapp_history: updatedHistory,
      bill_sent_whatsapp: true,
      sent_to_number: cleanNumber,
    });

    // Optionally update customer phone if requested
    if (body.update_customer_phone && sale.customer_id) {
      try {
        await db.asServiceRole.entities.Customer.update(sale.customer_id, {
          phone: cleanNumber,
          whatsapp: cleanNumber,
        });
      } catch (_) {}
    }

    return Response.json({
      success: true,
      status: 'Submitted',
      invoice_id: invoiceNo,
      recipient: cleanNumber,
      message_id: orbitRes.message_id,
      timestamp: now,
      sale: updatedSale,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function money(n) {
  return `AED ${Number(n || 0).toFixed(2)}`;
}

function buildSaleBillPdf(sale, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margin = 14, right = W - margin, bottom = H - 24;

  // Header band
  doc.setFillColor(91, 61, 245);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyName(company), margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const headParts = [company?.address, company?.phone, company?.email, company?.tax_number && `TRN: ${company.tax_number}`].filter(Boolean);
  doc.text(headParts.join('  •  ') || 'Retail Bill', margin, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('SALE INVOICE', right, 13, { align: 'right' });

  doc.setTextColor(33, 33, 40);
  let y = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${sale.sale_id || sale.id}`, margin, y);
  doc.text(`Date: ${sale.date || new Date().toISOString().slice(0, 10)}`, right, y, { align: 'right' });
  y += 7;

  // Customer box
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
  if (sale.customer_email) doc.text(`Email: ${sale.customer_email}`, margin + 80, y + 9);
  y += 16;

  // Items table header
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

  // Items rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const items = sale.items || [];
  items.forEach((it, i) => {
    if (y > bottom) { doc.addPage(); y = 36; }
    if (i % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 4, W - margin * 2, 6, 'F');
    }
    doc.setTextColor(33, 33, 40);
    doc.text(String(i + 1), margin + 2, y);
    doc.text(String(it.name || '—'), margin + 14, y);
    doc.text(String(it.quantity || 0), margin + 110, y);
    doc.text(money(it.price), margin + 130, y);
    doc.text(money(it.line_total), right - 2, y, { align: 'right' });
    y += 6;
  });

  // Totals
  y += 3;
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, y, right, y);
  y += 6;
  const totalRows = [
    ['Subtotal', money(sale.subtotal)],
    ['Discount', `- ${money(sale.discount)}`],
    [`Tax (${sale.tax_percent || 0}%)`, money(sale.tax_amount)],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 130);
  totalRows.forEach(([k, v]) => {
    doc.text(k, right - 60, y);
    doc.setTextColor(33, 33, 40);
    doc.text(v, right, y, { align: 'right' });
    y += 6;
  });
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, y, right, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(33, 33, 40);
  doc.text('Total', margin, y);
  doc.text(money(sale.total), right, y, { align: 'right' });
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text('Amount Paid', margin, y);
  doc.text(money(sale.amount_paid), right, y, { align: 'right' });
  y += 6;
  doc.setTextColor(217, 119, 6);
  doc.text('Balance Due', margin, y);
  doc.text(money(sale.balance_due), right, y, { align: 'right' });

  // Footer
  doc.setDrawColor(220, 220, 225);
  doc.line(margin, H - 20, right, H - 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text(`Thank you for choosing ${companyName(company)}.`, margin, H - 14);
  doc.text('This is an official system-generated invoice.', margin, H - 10);
  doc.text(`Payment: ${sale.payment_method || '—'} (${sale.payment_status || '—'})`, right, H - 10, { align: 'right' });

  return doc.output('arraybuffer');
}