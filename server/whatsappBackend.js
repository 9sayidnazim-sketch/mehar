// Protected Backend Service for WhatsApp PDF Invoice Sending via Orbit Gateway
// NEVER expose ORBIT_INSTANCE_TOKEN to frontend code, public env vars, logs, or client responses.
// Redact authentication headers from all error reporting.

import { jsPDF } from 'jspdf';
import fs from 'node:fs';
import path from 'node:path';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

// Load secrets exclusively from backend environment secrets
function getEnvConfig() {
  if (!process.env.ORBIT_INSTANCE_TOKEN || !process.env.ORBIT_API_URL) {
    try {
      const envLocalPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envLocalPath)) {
        const content = fs.readFileSync(envLocalPath, 'utf-8');
        for (const line of content.split('\n')) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value.trim();
          }
        }
      }
    } catch (_) {}
  }

  return {
    apiUrl: (process.env.ORBIT_API_URL || '').replace(/\/+$/, ''),
    instanceToken: process.env.ORBIT_INSTANCE_TOKEN || '',
    instanceId: process.env.ORBIT_INSTANCE_ID || '',
    senderNumber: process.env.ORBIT_SENDER_NUMBER || '+639562441681',
    horusWebhookUrl: process.env.HORUS_WEBHOOK_URL || ''
  };
}

// Persistent Storage Directories & Files
const BASE_DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_DIR = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ? path.join('/tmp', '.data')
  : BASE_DATA_DIR;
const SEND_RECORDS_FILE = path.join(DATA_DIR, 'invoice_send_records.json');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (DATA_DIR !== BASE_DATA_DIR && fs.existsSync(BASE_DATA_DIR)) {
      const srcDb = path.join(BASE_DATA_DIR, 'db.json');
      const srcRecords = path.join(BASE_DATA_DIR, 'invoice_send_records.json');
      if (!fs.existsSync(DB_FILE) && fs.existsSync(srcDb)) {
        try { fs.copyFileSync(srcDb, DB_FILE); } catch (_) {}
      }
      if (!fs.existsSync(SEND_RECORDS_FILE) && fs.existsSync(srcRecords)) {
        try { fs.copyFileSync(srcRecords, SEND_RECORDS_FILE); } catch (_) {}
      }
    }
  } catch (err) {
    console.error('[WhatsApp Backend] Failed to initialize data directory:', err.message);
  }
}

export function loadJsonFile(filePath, defaultVal = []) {
  try {
    ensureDataDir();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn(`[WhatsApp Backend] Error loading ${filePath}:`, e.message);
  }
  return defaultVal;
}

export function saveJsonFile(filePath, data) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`[WhatsApp Backend] Error saving ${filePath}:`, e.message);
  }
}

/**
 * Validates customer phone number with libphonenumber-js.
 * Requires an explicit international country code.
 * Rejects domestic numbers (e.g. leading 0, 09) and missing country codes.
 * Returns digits-only for Orbit API dispatch.
 */
export function validateCustomerNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      isValid: false,
      error: 'Customer phone number is required and cannot be empty.'
    };
  }

  const trimmed = rawPhone.trim();

  // If number starts with domestic prefix '0' (e.g. 050..., 09...), reject immediately
  if (/^0[1-9]/.test(trimmed)) {
    return {
      isValid: false,
      error: `Phone number "${trimmed}" starts with domestic prefix '0', indicating a missing country code. An explicit international country code is required (e.g. +971 50... for UAE, +63 9... for Philippines). A country code cannot be silently assumed.`
    };
  }

  let parseTarget = trimmed;
  if (!parseTarget.startsWith('+')) {
    parseTarget = '+' + parseTarget;
  }

  try {
    const parsed = parsePhoneNumberWithError(parseTarget);
    if (!parsed || !parsed.isValid()) {
      return {
        isValid: false,
        error: `Phone number "${trimmed}" is invalid according to international phone standards. Please check the digits and country code.`
      };
    }

    const digits = `${parsed.countryCallingCode}${parsed.nationalNumber}`;
    return {
      isValid: true,
      country: parsed.country,
      callingCode: parsed.countryCallingCode,
      digits, // Digits only, including country code (for Orbit POST /send/media)
      formatted: parsed.formatInternational(), // e.g. "+63 956 244 1681"
      e164: parsed.format('E.164') // e.g. "+639562441681"
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Invalid international phone number: ${err.message}. An explicit international country code is required.`
    };
  }
}

/**
 * Sanitizes invoice numbers for safe filesystem filenames
 * without changing their displayed identity.
 */
export function sanitizeInvoiceFilename(invoiceNumber) {
  const safeNumber = String(invoiceNumber || '0001')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `invoice-${safeNumber}.pdf`;
}

/**
 * Check Orbit Gateway instance status
 * GET {ORBIT_API_URL}/instance/status
 * Header: apikey: {ORBIT_INSTANCE_TOKEN}
 * Redacts authentication headers from error reporting.
 */
export async function checkOrbitInstanceStatus(timeoutMs = 7000) {
  const { apiUrl, instanceToken, senderNumber } = getEnvConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiUrl}/instance/status`, {
      method: 'GET',
      headers: {
        apikey: instanceToken,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    // 1. Handle HTTP 401 Unauthorized
    if (res.status === 401) {
      return {
        ok: false,
        paired: false,
        loggedIn: false,
        errorCategory: 'unauthorized',
        httpStatus: 401,
        message: 'Orbit gateway authentication failed (HTTP 401 Unauthorized). The instance token is unverified or invalid. Connect the sender account and provide a valid instance token before sending.',
        error: 'Authentication failed (HTTP 401 Unauthorized): instance token is unverified.'
      };
    }

    // 2. Handle other non-200 responses
    if (!res.ok) {
      return {
        ok: false,
        paired: false,
        loggedIn: false,
        errorCategory: 'gateway_unavailable',
        httpStatus: res.status,
        message: `WhatsApp gateway returned HTTP ${res.status}. Connect the sender account before sending this invoice.`,
        error: `Gateway returned HTTP ${res.status}: ${res.statusText}`
      };
    }

    // 3. Parse JSON response
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== 'object' || !json.data) {
      return {
        ok: false,
        paired: false,
        loggedIn: false,
        errorCategory: 'malformed_response',
        message: 'WhatsApp gateway returned an ambiguous or malformed status response. Never treat an unavailable status as successfully paired.',
        error: 'Malformed gateway status response'
      };
    }

    const data = json.data;
    const loggedIn = Boolean(data.LoggedIn);
    const connected = Boolean(data.Connected);

    // 4. Inspect data.LoggedIn
    if (!loggedIn) {
      return {
        ok: true,
        paired: false,
        loggedIn: false,
        connected,
        errorCategory: 'unpaired',
        data,
        senderNumber,
        message: 'WhatsApp is not paired. Connect the sender account before sending this invoice.'
      };
    }

    // 5. Verify that authenticated instance matches intended sender
    const cleanIntended = senderNumber.replace(/[^0-9]/g, '');
    const candidateNumber = String(data.Phone || data.number || data.jid || data.Name || '').replace(/[^0-9]/g, '');
    if (candidateNumber && candidateNumber.length >= 8 && !candidateNumber.includes(cleanIntended) && !cleanIntended.includes(candidateNumber)) {
      return {
        ok: false,
        paired: false,
        loggedIn: true,
        errorCategory: 'sender_mismatch',
        message: `Authenticated WhatsApp session (+${candidateNumber}) does not match the intended sender (+${cleanIntended}).`,
        error: 'Instance sender mismatch'
      };
    }

    return {
      ok: true,
      paired: true,
      loggedIn: true,
      connected,
      data,
      senderNumber,
      message: 'WhatsApp instance is connected, paired, and ready.'
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    return {
      ok: false,
      paired: false,
      loggedIn: false,
      errorCategory: isTimeout ? 'gateway_timeout' : 'gateway_unavailable',
      message: isTimeout
        ? 'WhatsApp gateway timed out. Unable to verify pairing status.'
        : 'WhatsApp gateway is offline or unreachable.',
      error: isTimeout ? 'Timeout checking WhatsApp gateway status' : (err.message || 'Network error')
    };
  }
}

/**
 * Persistent Database Idempotency & Send Records Manager
 */
export function getInvoiceSendRecords(invoiceId) {
  const records = loadJsonFile(SEND_RECORDS_FILE, []);
  if (!Array.isArray(records)) return [];
  return invoiceId ? records.filter((r) => r.invoice_id === invoiceId) : records;
}

export function claimInvoiceSendRecord({
  invoiceId,
  invoiceNumber,
  userId,
  idempotencyKey,
  recipient,
  recipientDigits,
  allowResend = false
}) {
  const records = loadJsonFile(SEND_RECORDS_FILE, []);

  // 1. Check if identical (invoiceId, idempotencyKey) already exists
  const existingKey = records.find(
    (r) => r.invoice_id === invoiceId && r.idempotency_key === idempotencyKey
  );
  if (existingKey) {
    return {
      status: 'existing_key',
      record: existingKey
    };
  }

  // 2. Prevent new requests from bypassing duplicate protection while pending, submitted, or unknown
  // Any deliberate resend must be a separately confirmed action after reviewing send history.
  const activeRecord = records.find(
    (r) =>
      r.invoice_id === invoiceId &&
      ['pending', 'submitted', 'unknown'].includes(r.status)
  );

  if (activeRecord && !allowResend) {
    return {
      status: 'duplicate_prevented',
      record: activeRecord,
      message: `Invoice ${invoiceNumber} already has an active dispatch record (Status: ${activeRecord.status.toUpperCase()}, Recipient: ${activeRecord.recipient}). Deliberate resend must be confirmed after reviewing send history.`
    };
  }

  // 3. Atomic Claim: Create and save pending record synchronously
  const newRecord = {
    id: `send-${invoiceId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    tenant_user_id: userId || 'usr-admin-1',
    idempotency_key: idempotencyKey,
    recipient,
    recipient_digits: recipientDigits,
    attempt_time: new Date().toISOString(),
    submission_time: null,
    gateway_message_id: null,
    status: 'pending',
    sanitized_error_category: null,
    sanitized_error_message: null,
    resend_confirmed: Boolean(allowResend)
  };

  records.unshift(newRecord);
  saveJsonFile(SEND_RECORDS_FILE, records);

  return {
    status: 'claimed',
    record: newRecord
  };
}

export function updateInvoiceSendRecord(recordId, updates) {
  const records = loadJsonFile(SEND_RECORDS_FILE, []);
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...updates };
    saveJsonFile(SEND_RECORDS_FILE, records);
    return records[idx];
  }
  return null;
}

/**
 * Retrieve invoice and customer from persistent server storage (.data/db.json)
 */
export function getInvoiceFromDb(invoiceId) {
  const dbData = loadJsonFile(DB_FILE, {});
  const sales = dbData.Sale || [];
  const orders = dbData.Order || [];
  const customers = dbData.Customer || [];
  const companies = dbData.Company || [];

  const sale = sales.find((s) => s.id === invoiceId || s.sale_id === invoiceId) || null;
  const order = orders.find((o) => o.id === invoiceId || o.order_id === invoiceId) || null;

  let invoiceEntity = sale;
  let isOrder = false;

  if (!invoiceEntity && order) {
    isOrder = true;
    invoiceEntity = {
      id: order.id,
      sale_id: order.order_id || `ORD-${order.id.slice(-6)}`,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      items: [
        {
          name: order.template_name || 'Tailored Garment',
          price: order.total_amount || 0,
          quantity: 1,
          line_total: order.total_amount || 0
        }
      ],
      subtotal: order.subtotal || order.total_amount || 0,
      discount: order.discount || 0,
      tax_percent: order.tax_percent || 5,
      tax_amount: order.tax_amount || 0,
      total: order.total_amount || 0,
      amount_paid: order.amount_paid || 0,
      balance_due: order.balance_due || 0,
      payment_method: order.payment_method || 'Card',
      payment_status: order.payment_status || 'Partial',
      date: order.booking_date || new Date().toISOString().slice(0, 10),
      status: order.status || 'Booked'
    };
  }

  const customerId = invoiceEntity?.customer_id;
  const customer = customerId ? customers.find((c) => c.id === customerId) || null : null;
  const company = companies[0] || null;

  return { sale: invoiceEntity, rawOrder: order, customer, company, isOrder };
}

/**
 * Sync invoice and optional customer record to persistent database (.data/db.json)
 */
export function syncInvoiceToDb(invoiceOrSale, customer) {
  if (!invoiceOrSale || !invoiceOrSale.id) return;
  const dbData = loadJsonFile(DB_FILE, {});
  if (!dbData.Sale) dbData.Sale = [];
  if (!dbData.Customer) dbData.Customer = [];

  const existingSaleIdx = dbData.Sale.findIndex(
    (s) => s.id === invoiceOrSale.id || s.sale_id === invoiceOrSale.sale_id
  );
  if (existingSaleIdx !== -1) {
    dbData.Sale[existingSaleIdx] = { ...dbData.Sale[existingSaleIdx], ...invoiceOrSale };
  } else {
    dbData.Sale.push(invoiceOrSale);
  }

  if (customer && customer.id) {
    const existingCustIdx = dbData.Customer.findIndex((c) => c.id === customer.id);
    if (existingCustIdx !== -1) {
      dbData.Customer[existingCustIdx] = { ...dbData.Customer[existingCustIdx], ...customer };
    } else {
      dbData.Customer.push(customer);
    }
  }

  saveJsonFile(DB_FILE, dbData);
}

/**
 * Dispatches PDF to Orbit POST /send/media as multipart/form-data
 * Header: apikey = ORBIT_INSTANCE_TOKEN
 * Let HTTP client generate multipart Content-Type boundary
 */
export async function sendPdfToOrbitGateway({ number, filename, caption, pdfBuffer, timeoutMs = 20000 }) {
  const { apiUrl, instanceToken } = getEnvConfig();

  const formData = new FormData();
  formData.append('number', number);
  formData.append('type', 'document');
  formData.append('filename', filename);
  formData.append('caption', caption);

  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', pdfBlob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiUrl}/send/media`, {
      method: 'POST',
      headers: {
        apikey: instanceToken
        // Do NOT set Content-Type header manually; fetch will generate boundary!
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timer);

    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { raw: text };
    }

    if (!res.ok) {
      const errMsg = json.error || json.message || `Orbit Gateway returned HTTP ${res.status}`;
      return {
        ok: false,
        status: 'failed',
        error: errMsg,
        httpStatus: res.status,
        errorCategory: res.status === 401 ? 'unauthorized' : 'dispatch_error'
      };
    }

    // Success response from Orbit
    const messageId = json.data?.id || json.data?.message_id || json.id || json.message_id || `msg-${Date.now()}`;
    return {
      ok: true,
      status: 'submitted', // API success means submitted, not yet delivered
      messageId,
      details: json
    };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    if (isTimeout) {
      return {
        ok: false,
        status: 'unknown', // Mark as unknown on timeout, do not auto-resend
        errorCategory: 'timeout',
        error: `Gateway request timed out after ${timeoutMs / 1000}s. Result is unknown; do not automatically resend.`
      };
    }
    return {
      ok: false,
      status: 'failed',
      errorCategory: 'dispatch_error',
      error: err.message || 'Network dispatch error'
    };
  }
}

/**
 * Server-side PDF generation using jsPDF matching Thredo's existing invoice layout
 */
export function generateServerInvoicePdf(sale, customer, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, margin = 14, right = W - margin;
  let y = 36;

  const PRIMARY = [91, 61, 245];
  const INK = [33, 33, 40];
  const MUTED = [120, 120, 130];
  const LINE = [220, 220, 225];
  const EMERALD = [16, 185, 129];
  const AMBER = [217, 119, 6];
  const MUTED_BG = [245, 245, 250];

  const compName = company?.name || 'THREDO Tailoring & POS';

  // Brand Header
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(compName, margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const headParts = [
    company?.address,
    company?.phone,
    company?.email,
    company?.tax_number ? `TRN: ${company.tax_number}` : ''
  ].filter(Boolean);
  doc.text(headParts.join('  •  ') || 'Tailoring ERP', margin, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TAX INVOICE', right, 13, { align: 'right' });

  // Invoice Meta
  const invoiceNo = sale.sale_id || (sale.id ? `INV-${sale.id.slice(-6).toUpperCase()}` : 'INV-0001');
  const saleDate = sale.date || new Date().toISOString().slice(0, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text(`Invoice No: ${invoiceNo}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${saleDate}`, right, y, { align: 'right' });
  y += 8;

  // Billed To Card
  doc.setFillColor(...MUTED_BG);
  doc.roundedRect(margin, y - 4, W - margin * 2, 24, 2, 2, 'F');
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, y - 4, W - margin * 2, 24, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text('BILLED TO:', margin + 4, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const custName = customer?.name || sale.customer_name || 'Walk-in Customer';
  doc.text(custName, margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const custPhone = customer?.phone || customer?.whatsapp || sale.customer_phone || '—';
  const custEmail = customer?.email || sale.customer_email || '—';
  const custAddress = customer?.address || customer?.city || 'Dubai, UAE';
  doc.text(`Phone: ${custPhone}   •   Email: ${custEmail}`, margin + 4, y + 10);
  doc.text(`Address: ${custAddress}`, margin + 4, y + 14);

  y += 26;

  // Items Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text('PURCHASED ITEMS', margin, y);
  y += 5;

  const tableW = W - margin * 2;
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y - 4, tableW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM DESCRIPTION', margin + 3, y);
  doc.text('PRICE', right - 60, y, { align: 'right' });
  doc.text('QTY', right - 35, y, { align: 'right' });
  doc.text('TOTAL (AED)', right - 3, y, { align: 'right' });
  y += 7;

  // Items List
  const items = sale.items && sale.items.length > 0
    ? sale.items
    : [{ name: 'Retail Items', price: sale.total || 0, quantity: 1, line_total: sale.total || 0 }];

  items.forEach((it, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y - 4, tableW, 7, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(it.name || 'Item', margin + 3, y);
    doc.text(`AED ${Number(it.price || 0).toFixed(2)}`, right - 60, y, { align: 'right' });
    doc.text(String(it.quantity || 1), right - 35, y, { align: 'right' });
    doc.text(`AED ${Number(it.line_total || it.price * it.quantity || 0).toFixed(2)}`, right - 3, y, { align: 'right' });
    y += 7;
  });

  y += 4;
  doc.setDrawColor(...LINE);
  doc.line(margin, y, right, y);
  y += 6;

  // Pricing Summary
  const summaryX = right - 75;
  const valX = right - 3;
  const drawRow = (label, val, isBold = false, color = INK) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 9.5 : 8.5);
    doc.setTextColor(...(isBold ? PRIMARY : MUTED));
    doc.text(label, summaryX, y);
    doc.setTextColor(...color);
    doc.text(val, valX, y, { align: 'right' });
    y += 5.5;
  };

  drawRow('Subtotal:', `AED ${Number(sale.subtotal || sale.total || 0).toFixed(2)}`);
  if (sale.discount > 0) {
    drawRow('Discount:', `-AED ${Number(sale.discount).toFixed(2)}`, false, EMERALD);
  }
  const taxAmount = Number(sale.tax_amount || 0);
  const taxPercent = Number(sale.tax_percent || 5);
  drawRow(`VAT (${taxPercent}%):`, `AED ${taxAmount.toFixed(2)}`);

  doc.setDrawColor(...LINE);
  doc.line(summaryX, y - 2, right, y - 2);
  y += 1;

  drawRow('Total Amount:', `AED ${Number(sale.total || 0).toFixed(2)}`, true, PRIMARY);
  drawRow('Amount Paid:', `AED ${Number(sale.amount_paid || 0).toFixed(2)}`, false, EMERALD);
  if (Number(sale.balance_due || 0) > 0) {
    drawRow('Balance Due:', `AED ${Number(sale.balance_due).toFixed(2)}`, true, AMBER);
  }

  // Payment Details Stamp
  const payBoxY = Math.min(y - 25, H - 42);
  doc.setFillColor(...MUTED_BG);
  doc.roundedRect(margin, payBoxY, 80, 20, 2, 2, 'F');
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, payBoxY, 80, 20, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text('PAYMENT DETAILS', margin + 4, payBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text(`Method: ${sale.payment_method || 'Cash'}`, margin + 4, payBoxY + 10);
  const isPaid = (sale.amount_paid || 0) >= (sale.total || 0) || sale.payment_status === 'Paid';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isPaid ? EMERALD : AMBER));
  doc.text(`Status: ${isPaid ? 'PAID IN FULL' : 'PARTIAL / PENDING'}`, margin + 4, payBoxY + 15);

  // Footer
  doc.setDrawColor(...LINE);
  doc.line(margin, H - 20, right, H - 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Thank you for shopping at ${compName}.`, margin, H - 14);
  doc.text('This is a system-generated tax invoice.', margin, H - 10);
  doc.text(compName, right, H - 10, { align: 'right' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Handle protected invoice send request
 */
export async function handleSendInvoiceRequest({
  invoiceId,
  idempotencyKey,
  previewRecipient,
  allowResend = false,
  user,
  getInvoiceFn
}) {
  // 1. Authenticate user and verify access
  if (!user) {
    return {
      status: 401,
      body: { error: 'Authentication required. Please log in.' }
    };
  }

  if (!invoiceId) {
    return {
      status: 400,
      body: { error: 'invoice_id is required.' }
    };
  }

  if (!idempotencyKey) {
    return {
      status: 400,
      body: { error: 'idempotency_key is required for duplicate prevention.' }
    };
  }

  // 2. Load trusted invoice & verify access server-side
  const { sale, customer, company } = await getInvoiceFn(invoiceId);
  if (!sale) {
    return {
      status: 404,
      body: { error: `Invoice with ID ${invoiceId} not found.` }
    };
  }

  const invoiceNumber = sale.sale_id || (sale.id ? `INV-${sale.id.slice(-6).toUpperCase()}` : 'INV-0001');
  const customerDisplayName = sale.customer_name || customer?.name || 'Customer';

  // 3. Load customer phone number from trusted server-side record
  // Do NOT accept caller-supplied customer numbers or PDF URLs
  const rawNumber = sale.customer_phone || customer?.phone || customer?.whatsapp || '';
  const val = validateCustomerNumber(rawNumber);
  if (!val.isValid) {
    return {
      status: 400,
      body: {
        error: val.error,
        customer_number_invalid: true,
        destination_number: rawNumber
      }
    };
  }

  // If destination changed after preview, require explicit confirmation
  if (previewRecipient) {
    const cleanPreview = previewRecipient.replace(/[^0-9]/g, '');
    if (cleanPreview && cleanPreview !== val.digits) {
      return {
        status: 409,
        body: {
          error: `Customer phone number changed after preview. Current verified destination is ${val.formatted}. Please confirm the updated destination number.`,
          phone_changed: true,
          current_destination: val.formatted
        }
      };
    }
  }

  // 4. Check Idempotency & Duplicate Protection via Persistent Database Claim
  const claimResult = claimInvoiceSendRecord({
    invoiceId,
    invoiceNumber,
    userId: user.id,
    idempotencyKey,
    recipient: val.formatted,
    recipientDigits: val.digits,
    allowResend
  });

  // If exact idempotency key exists, return saved result immediately without calling Orbit
  if (claimResult.status === 'existing_key') {
    const existing = claimResult.record;
    return {
      status: 200,
      body: {
        success: existing.status === 'submitted' || existing.status === 'delivered' || existing.status === 'read',
        status: existing.status,
        message_id: existing.gateway_message_id,
        destination_number: existing.recipient,
        sent_at: existing.submission_time || existing.attempt_time,
        idempotent_replay: true,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        error: existing.sanitized_error_message
      }
    };
  }

  // If another send was already submitted/pending and resend not confirmed
  if (claimResult.status === 'duplicate_prevented') {
    return {
      status: 409,
      body: {
        error: claimResult.message,
        duplicate_prevented: true,
        existing_status: claimResult.record.status,
        existing_recipient: claimResult.record.recipient,
        existing_attempt: claimResult.record.submission_time || claimResult.record.attempt_time,
        history: getInvoiceSendRecords(invoiceId)
      }
    };
  }

  const sendRecord = claimResult.record;

  // 5. PAIRING & GATEWAY STATUS CHECK
  const statusCheck = await checkOrbitInstanceStatus();
  if (!statusCheck.ok || !statusCheck.paired) {
    // Record failure in persistent database
    updateInvoiceSendRecord(sendRecord.id, {
      status: 'failed',
      sanitized_error_category: statusCheck.errorCategory || 'unpaired',
      sanitized_error_message: statusCheck.message
    });

    const httpCode = statusCheck.errorCategory === 'unauthorized' ? 401 : 503;
    return {
      status: httpCode,
      body: {
        error: statusCheck.message,
        pairing_needed: !statusCheck.paired,
        error_category: statusCheck.errorCategory,
        destination_number: val.formatted
      }
    };
  }

  // 6. SERVER-SIDE PDF GENERATION & FILENAME SANITIZATION
  const filename = sanitizeInvoiceFilename(invoiceNumber);
  const caption = `Hello ${customerDisplayName}, here is your Thredo invoice ${invoiceNumber}. Thank you.`;
  const pdfBuffer = generateServerInvoicePdf(sale, customer, company);

  // 7. PDF SEND CONTRACT: POST /send/media as multipart/form-data
  const sendResult = await sendPdfToOrbitGateway({
    number: val.digits,
    filename,
    caption,
    pdfBuffer
  });

  const nowIso = new Date().toISOString();

  // 8. UPDATE PERSISTENT DATABASE RECORD
  const updatedRecord = updateInvoiceSendRecord(sendRecord.id, {
    status: sendResult.status, // 'submitted', 'unknown', or 'failed'
    submission_time: sendResult.ok ? nowIso : null,
    gateway_message_id: sendResult.messageId || null,
    sanitized_error_category: sendResult.ok ? null : (sendResult.errorCategory || 'dispatch_error'),
    sanitized_error_message: sendResult.ok ? null : (sendResult.error || 'Dispatch failed')
  });

  return {
    status: sendResult.ok ? 200 : (sendResult.status === 'unknown' ? 504 : 502),
    body: {
      success: sendResult.ok,
      status: sendResult.status, // 'submitted', 'unknown', 'failed'
      message_id: sendResult.messageId || null,
      destination_number: val.formatted,
      sent_at: nowIso,
      error: sendResult.error || null,
      error_category: sendResult.errorCategory || null,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      record_id: updatedRecord?.id
    }
  };
}

/**
 * Handle Receipt Webhook Callbacks from Orbit
 * Preserves Horus MESSAGE webhook
 */
export async function handleOrbitWebhook(body) {
  const eventType = body?.type || body?.event || body?.event_type || '';
  console.log('[Orbit Webhook] Received webhook event:', eventType);

  // Forward incoming customer messages to Horus agent
  const { horusWebhookUrl } = getEnvConfig();
  if (eventType === 'message' || body?.data?.message || body?.message) {
    if (horusWebhookUrl) {
      try {
        await fetch(horusWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch (err) {
        console.warn('[Orbit Webhook] Forwarding to Horus failed:', err.message);
      }
    }
  }

  // Delivery receipts: update persistent records
  if (eventType === 'receipt' || eventType === 'status' || body?.receipt || body?.status) {
    const messageId = body?.data?.id || body?.message_id || body?.id;
    const newStatus = (body?.data?.status || body?.status || '').toLowerCase(); // 'delivered', 'read'

    if (messageId && (newStatus === 'delivered' || newStatus === 'read')) {
      const records = loadJsonFile(SEND_RECORDS_FILE, []);
      let changed = false;
      for (const rec of records) {
        if (rec.gateway_message_id === messageId) {
          rec.status = newStatus;
          changed = true;
        }
      }
      if (changed) {
        saveJsonFile(SEND_RECORDS_FILE, records);
      }
    }
  }
}
