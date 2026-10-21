import { jsPDF } from 'jspdf';
import { checkOrbitStatus, sendOrbitMediaDocument } from '../../base44/shared/whatsapp.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const paymentId = body.payment_id || body.id;
    const payment = body.payment_draft || {
      id: paymentId || 'PAY-' + Date.now(),
      amount: body.amount || (body.order_draft && body.order_draft.total_amount) || 0,
      order_id: body.order_id,
      order_ref: body.order_ref,
      date: new Date().toISOString().slice(0, 10),
      type: 'payment'
    };

    if (payment.type === 'refund') {
      return res.status(200).json({ skipped: true, reason: 'refund — no invoice sent' });
    }

    const order = body.order_draft || null;
    const customer = body.customer_draft || null;

    const rawNumber = body.phone || (customer && (customer.whatsapp || customer.phone)) || (order && order.customer_phone) || '';
    const cleanNumber = String(rawNumber).replace(/\D/g, '');
    if (cleanNumber.length < 8 || cleanNumber.length > 15) {
      return res.status(400).json({
        error: 'Invalid recipient phone number. Must include country code and contain 8 to 15 digits.'
      });
    }

    const apiUrl = process.env.ORBIT_API_URL || 'https://orbit-35-154-242-129.sslip.io';
    const apiKey = process.env.ORBIT_INSTANCE_TOKEN || '98fbdc66-d18e-423b-a7bc-8e308fd00277';

    const statusCheck = await checkOrbitStatus({ apiUrl, apiKey });
    if (!statusCheck.ok) {
      if (body.dev_simulate || process.env.DEV_MOCK_WHATSAPP === 'true') {
        const orderRef = (order && order.order_id) || body.order_ref || payment.order_ref || (paymentId ? String(paymentId).slice(-6) : 'INV-001');
        return res.status(200).json({
          success: true,
          simulated: true,
          status: 'Submitted',
          invoice_id: orderRef,
          recipient: cleanNumber,
          to: cleanNumber,
          message_id: 'sim_' + Date.now(),
          timestamp: new Date().toISOString(),
          message: `Dev Mode: Simulated WhatsApp invoice sent to +${cleanNumber}`
        });
      }
      return res.status(503).json({
        error: 'Orbit WhatsApp instance is not connected or logged in.',
        not_logged_in: true,
        qr_available: true,
        details: statusCheck.details || statusCheck.error
      });
    }

    const orderRef = (order && order.order_id) || body.order_ref || payment.order_ref || (paymentId ? String(paymentId).slice(-6) : 'INV-001');

    // Generate Order Invoice PDF
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, margin = 15, right = W - margin;
    let y = 20;

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Invoice No: ${orderRef}`, margin, y);
    doc.text(`Date: ${payment.date || new Date().toISOString().slice(0, 10)}`, right, y, { align: 'right' });
    y += 8;

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
    doc.text(money(order?.total_amount || payment.amount || 0), right, y, { align: 'right' });
    y += 7;
    doc.setTextColor(16, 185, 129);
    doc.text(`Amount Paid (${payment.type || 'Payment'})`, margin, y);
    doc.text(money(payment.amount || order?.total_amount || 0), right, y, { align: 'right' });
    y += 7;
    doc.setTextColor(245, 158, 11);
    doc.text('Balance Due', margin, y);
    doc.text(money(order?.balance_due || 0), right, y, { align: 'right' });
    y += 12;

    doc.setDrawColor(220, 220, 225);
    doc.line(margin, H - 20, right, H - 20);
    doc.setTextColor(120, 120, 130);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for choosing THREDO.', margin, H - 14);
    doc.text('This is an official system-generated invoice.', margin, H - 10);

    const pdfBytes = doc.output('arraybuffer');
    const fileName = `invoice-${orderRef}.pdf`;
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
      apiKey,
      to: cleanNumber,
      pdfBytes,
      fileName,
      caption: captionLines.join('\n'),
      timeoutMs: 15000
    });

    if (orbitRes.timed_out) {
      return res.status(504).json({
        success: false,
        timed_out: true,
        error: 'Result unknown—check before retrying',
        order_ref: orderRef,
        to: cleanNumber
      });
    }

    if (!orbitRes.ok) {
      return res.status(502).json({
        success: false,
        error: orbitRes.error || 'Failed to dispatch invoice via Orbit WhatsApp',
        details: orbitRes.details
      });
    }

    return res.status(200).json({
      success: true,
      status: 'Submitted',
      message_id: orbitRes.message_id,
      to: cleanNumber,
      order_ref: orderRef
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
