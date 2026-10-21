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

    const invoiceId = body.invoice_id || body.sale_id || body.id || (body.sale_draft && (body.sale_draft.sale_id || body.sale_draft.id)) || 'INV-0001';
    const sale = body.sale_draft || {
      id: invoiceId,
      sale_id: invoiceId,
      customer_name: body.customer_name || 'Walk-in Customer',
      customer_phone: body.phone || '',
      total: body.total || 0,
      amount_paid: body.total || 0,
      balance_due: 0,
      date: new Date().toISOString().slice(0, 10),
      items: body.items || []
    };

    const recipientPhone = body.phone || sale.customer_phone || (body.sale_draft && body.sale_draft.customer_phone) || '';
    const cleanNumber = String(recipientPhone).replace(/\D/g, '');
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
        return res.status(200).json({
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
      return res.status(503).json({
        error: 'Orbit WhatsApp instance is not connected or logged in.',
        not_logged_in: true,
        qr_available: true,
        details: statusCheck.details || statusCheck.error
      });
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, margin = 14, right = W - margin;
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
    doc.text(`Invoice No: ${sale.sale_id || invoiceId}`, margin, y);
    doc.text(`Date: ${sale.date || new Date().toISOString().slice(0, 10)}`, right, y, { align: 'right' });
    y += 10;

    const custName = sale.customer_name || 'Customer';
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${custName}`, margin, y);
    if (sale.customer_phone) doc.text(`Phone: ${sale.customer_phone}`, margin + 80, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total Amount', margin, y);
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

    const pdfBytes = doc.output('arraybuffer');
    const invoiceNo = sale.sale_id || invoiceId;
    const fileName = `invoice-${invoiceNo}.pdf`;
    const caption = `Hello ${custName}, here is your invoice ${invoiceNo}. Thank you for choosing THREDO!`;

    const orbitRes = await sendOrbitMediaDocument({
      apiUrl,
      apiKey,
      to: cleanNumber,
      pdfBytes,
      fileName,
      caption,
      timeoutMs: 15000
    });

    if (orbitRes.timed_out) {
      return res.status(504).json({
        success: false,
        timed_out: true,
        error: 'Result unknown—check before retrying',
        invoice_id: invoiceNo,
        recipient: cleanNumber
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
      invoice_id: invoiceNo,
      recipient: cleanNumber,
      message_id: orbitRes.message_id,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
