const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { secrets } from 'base44:runtime';
import { sendWhatsAppDocument } from '../../shared/whatsapp.js';
import { getDefaultCompany, companyName } from '../../shared/company.js';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const saleId = body.sale_id;
    if (!saleId) return Response.json({ error: 'sale_id is required' }, { status: 400 });

    const sale = await db.asServiceRole.entities.Sale.get(saleId);
    if (!sale) return Response.json({ error: 'Sale not found' }, { status: 404 });

    const company = await getDefaultCompany(base44);
    const pdfBytes = buildSaleBillPdf(sale, company);
    const fileName = `bill-${sale.sale_id}.pdf`;

    // --- WhatsApp ---
    const waNumber = (sale.customer_phone || '').replace(/[^0-9]/g, '');
    let whatsapp = { skipped: true, reason: 'No customer phone number' };
    if (waNumber.length >= 8) {
      whatsapp = await sendWhatsAppDocument({
        secrets,
        to: waNumber,
        pdfBytes,
        fileName,
        caption: buildCaption(sale, company),
      });
    }

    // --- Email (registered app users only) ---
    let email = { skipped: true, reason: 'No customer email' };
    if (sale.customer_email) {
      try {
        await db.asServiceRole.integrations.Core.SendEmail({
          to: sale.customer_email,
          subject: `Your Bill from ${companyName(company)} — ${sale.sale_id}`,
          body: buildEmailBody(sale, company),
        });
        email = { ok: true };
        await db.asServiceRole.entities.Sale.update(saleId, { bill_sent_email: true });
      } catch (e) {
        // Most likely: recipient is not a registered app user (SendEmail reaches registered users only)
        email = { ok: false, error: e.message };
      }
    }

    if (whatsapp.ok) {
      await db.asServiceRole.entities.Sale.update(saleId, { bill_sent_whatsapp: true });
    }

    return Response.json({
      success: true,
      sale_id: sale.sale_id,
      whatsapp,
      email,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function money(n) {
  return `AED ${Number(n || 0).toFixed(2)}`;
}

function buildCaption(sale, company) {
  const lines = [
    `Thank you for your purchase at ${companyName(company)}!`,
    `Bill No: ${sale.sale_id}`,
    `Total: ${money(sale.total)}`,
    `Paid: ${money(sale.amount_paid)}`,
  ];
  if (sale.balance_due > 0) lines.push(`Balance Due: ${money(sale.balance_due)}`);
  return lines.join('\n');
}

function buildEmailBody(sale, company) {
  const items = (sale.items || [])
    .map((i) => `  • ${i.name} x${i.quantity} — ${money(i.line_total)}`)
    .join('\n');
  return [
    `Dear ${sale.customer_name || 'Customer'},`,
    '',
    `Thank you for your purchase at ${companyName(company)}.`,
    `Bill No: ${sale.sale_id}`,
    `Date: ${sale.date || ''}`,
    '',
    'Items:',
    items || '  —',
    '',
    `Subtotal: ${money(sale.subtotal)}`,
    `Discount: ${money(sale.discount)}`,
    `Tax (${sale.tax_percent || 0}%): ${money(sale.tax_amount)}`,
    `Total: ${money(sale.total)}`,
    `Paid: ${money(sale.amount_paid)}`,
    `Balance Due: ${money(sale.balance_due)}`,
    '',
    `— ${companyName(company)}`,
  ].join('\n');
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
  doc.text('SALE BILL', right, 13, { align: 'right' });

  doc.setTextColor(33, 33, 40);
  let y = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Bill No: ${sale.sale_id}`, margin, y);
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
  doc.text(`Thank you for shopping at ${companyName(company)}.`, margin, H - 14);
  doc.text('This is a system-generated bill.', margin, H - 10);
  doc.text(`Payment: ${sale.payment_method || '—'} (${sale.payment_status || '—'})`, right, H - 10, { align: 'right' });

  return doc.output('arraybuffer');
}