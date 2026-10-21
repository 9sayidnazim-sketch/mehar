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
    const paymentId = body.payment_id;
    if (!paymentId) return Response.json({ error: 'payment_id is required' }, { status: 400 });

    let payment = null;
    if (paymentId) {
      try {
        payment = await db.asServiceRole.entities.Payment.get(paymentId);
      } catch (_) {}
    }
    if (!payment && body.payment_draft) {
      payment = body.payment_draft;
    }
    if (!payment) {
      payment = {
        id: paymentId || 'PAY-' + Date.now(),
        amount: body.amount || (body.order_draft && body.order_draft.total_amount) || 0,
        order_id: body.order_id,
        order_ref: body.order_ref,
        date: new Date().toISOString().slice(0, 10),
        type: 'payment'
      };
    }

    if (payment.type === 'refund') {
      return Response.json({ skipped: true, reason: 'refund — no invoice sent' });
    }

    let order = body.order_draft || null;
    let customer = body.customer_draft || null;
    if (!order && payment.order_id) {
      try { order = await db.asServiceRole.entities.Order.get(payment.order_id); } catch (e) { /* order may be gone */ }
    }
    if (!customer && (payment.customer_id || (order && order.customer_id))) {
      const cid = payment.customer_id || order.customer_id;
      try { customer = await db.asServiceRole.entities.Customer.get(cid); } catch (e) { /* customer may be gone */ }
    }

    const rawNumber = body.phone || (customer && (customer.whatsapp || customer.phone)) || (order && order.customer_phone) || '';
    const waNumber = rawNumber.replace(/[^0-9]/g, '');
    if (waNumber.length < 8) {
      return Response.json({ error: 'Customer has no valid WhatsApp/phone number. Must be 8 to 15 digits.', customer_id: payment.customer_id }, { status: 400 });
    }

    const company = await getDefaultCompany(base44);
    const orderRef = (order && order.order_id) || payment.order_ref || paymentId.slice(-6);
    const fileName = `invoice-${orderRef}.pdf`;
    const pdfBytes = buildInvoicePdf(payment, order, customer, company);

    const money = (n) => `AED ${Number(n || 0).toFixed(2)}`;
    const captionLines = [
      `Thank you for your order with ${companyName(company)}!`,
      `Invoice: ${orderRef}`,
      `Amount Paid: ${money(payment.amount)}`,
    ];
    if (order) {
      captionLines.push(`Total: ${money(order.total_amount)}`);
      captionLines.push(`Balance Due: ${money(order.balance_due)}`);
      if (order.delivery_date) captionLines.push(`Delivery Date: ${order.delivery_date}`);
    }

    const wa = await sendWhatsAppDocument({
      secrets,
      to: waNumber,
      pdfBytes,
      fileName,
      caption: captionLines.join('\n'),
    });
    if (wa.timed_out) {
      return Response.json({
        success: false,
        timed_out: true,
        error: 'Result unknown—check before retrying',
        order_ref: orderRef,
        to: waNumber,
      }, { status: 504 });
    }
    if (!wa.ok) {
      return Response.json({ error: wa.error, details: wa.details }, { status: 502 });
    }

    return Response.json({
      success: true,
      status: 'Submitted',
      message_id: wa.message_id,
      to: wa.to,
      order_ref: orderRef,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildInvoicePdf(payment, order, customer, company) {
  const doc = new jsPDF();
  const W = 210, margin = 15;
  let y = 20;

  // --- Header band ---
  doc.setFillColor(91, 61, 245);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyName(company), margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const headParts = [company?.address, company?.phone, company?.email, company?.tax_number && `TRN: ${company.tax_number}`].filter(Boolean);
  doc.text(headParts.join('  •  ') || 'Invoice', margin, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', W - margin, 16, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  y = 42;
  const orderRef = (order && order.order_id) || payment.order_ref || '—';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${orderRef}`, margin, y);
  doc.text(`Date: ${payment.date || new Date().toISOString().slice(0, 10)}`, W - margin, y, { align: 'right' });
  y += 10;

  // --- Bill To ---
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  const custName = (customer && customer.name) || payment.customer_name || '—';
  doc.text(custName, margin, y); y += 5;
  if (customer && customer.phone) { doc.text(`Phone: ${customer.phone}`, margin, y); y += 5; }
  if (customer && customer.city) { doc.text(`City: ${customer.city}`, margin, y); y += 5; }
  if (customer && customer.address) { doc.text(`Address: ${customer.address}`, margin, y); y += 5; }
  y += 4;

  // --- Order details ---
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Order Details', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  const detailRows = [
    ['Order Type', order ? order.order_type : '—'],
    ['Priority', order ? order.priority : '—'],
    ['Status', order ? order.status : '—'],
    ['Booking Date', order ? order.booking_date : '—'],
    ['Delivery Date', order ? order.delivery_date : '—'],
    ['Delivery Method', order ? order.delivery_method : '—'],
    ['Tailor', (order && order.tailor_name) || 'Unassigned'],
    ['Fabric', (order && order.fabric_type) ? `${order.fabric_type} (${order.fabric_quantity || 0}m)` : '—'],
  ];
  detailRows.forEach(([k, v]) => {
    doc.setTextColor(120, 120, 120);
    doc.text(String(k), margin, y);
    doc.setTextColor(30, 30, 30);
    doc.text(String(v), margin + 60, y);
    y += 6;
  });

  // --- Pricing ---
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Pricing Summary', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  const money = (n) => `AED ${Number(n || 0).toFixed(2)}`;
  const priceRows = [
    ['Subtotal', order ? money(order.subtotal) : '—'],
    ['Markup', order ? `${order.markup_percent || 0}%` : '—'],
    ['Discount', order ? money(order.discount) : '—'],
    ['Tax', order ? `${order.tax_percent || 0}%` : '—'],
  ];
  priceRows.forEach(([k, v]) => {
    doc.setTextColor(120, 120, 120);
    doc.text(k, margin, y);
    doc.setTextColor(30, 30, 30);
    doc.text(String(v), W - margin, y, { align: 'right' });
    y += 6;
  });

  // Total / Paid / Balance
  y += 2;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Amount', margin, y);
  doc.text(money(order ? order.total_amount : 0), W - margin, y, { align: 'right' });
  y += 7;
  doc.setTextColor(16, 185, 129);
  doc.text(`Amount Paid (${payment.type || 'payment'})`, margin, y);
  doc.text(money(payment.amount), W - margin, y, { align: 'right' });
  y += 7;
  doc.setTextColor(245, 158, 11);
  doc.text('Balance Due', margin, y);
  doc.text(money(order ? order.balance_due : 0), W - margin, y, { align: 'right' });
  y += 12;

  // --- Footer ---
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Thank you for choosing ${companyName(company)}!`, margin, y);
  doc.text('This is a system-generated invoice.', margin, y + 5);

  return doc.output('arraybuffer');
}