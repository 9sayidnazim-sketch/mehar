import { db } from '../api/base44Client.js';
import { jsPDF } from 'jspdf';

import { formatCurrency, formatDate } from './mehar-utils.js';

const PRIMARY = [91, 61, 245];
const INK = [33, 33, 40];
const MUTED = [120, 120, 130];
const LINE = [220, 220, 225];
const EMERALD = [16, 185, 129];
const AMBER = [217, 119, 6];
const MUTED_BG = [245, 245, 250];

let _companyCache = null;
export async function getCompany() {
  if (_companyCache !== null) return _companyCache;
  try {
    const list = await db.entities.Company.filter({ is_default: true }, '-created_date', 1);
    _companyCache = (list && list[0]) || null;
  } catch (e) { _companyCache = null; }
  return _companyCache;
}
function companyLabel(company) {
  return (company && company.name) || 'THREDO Tailoring & POS';
}

function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' });
}

function brandHeader(doc, title, company) {
  const W = 210, margin = 14;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(companyLabel(company), margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const parts = [company?.address, company?.phone, company?.email, company?.tax_number && `TRN: ${company.tax_number}`].filter(Boolean);
  doc.text(parts.join('  •  ') || 'Tailoring ERP', margin, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, W - margin, 13, { align: 'right' });
  doc.setTextColor(...INK);
}

function footer(doc, company) {
  const W = 210, H = 297, margin = 14;
  doc.setDrawColor(...LINE);
  doc.line(margin, H - 20, W - margin, H - 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Thank you for choosing ${companyLabel(company)}.`, margin, H - 14);
  doc.text('This is a system-generated document.', margin, H - 10);
  doc.text(companyLabel(company), W - margin, H - 10, { align: 'right' });
}

function sectionTitle(doc, title, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text(title, x, y);
  doc.setTextColor(...INK);
}

function kv(doc, label, value, x, y, w) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(String(label), x, y);
  doc.setTextColor(...INK);
  doc.text(String(value ?? '—'), x + w, y);
}

function hr(doc, x1, x2, y) {
  doc.setDrawColor(...LINE);
  doc.line(x1, y, x2, y);
}

// Standard A4 bill/invoice for a single order
export async function downloadOrderBill(order, payments = [], customer = null) {
  const company = await getCompany();
  const doc = newDoc();
  const W = 210, margin = 14, right = W - margin;
  let y = 36;

  brandHeader(doc, 'TAX INVOICE', company);

  const orderRef = order.order_id || (order.id ? order.id.slice(-6) : '—');
  const today = new Date().toISOString().slice(0, 10);

  // Invoice meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${orderRef}`, margin, y);
  doc.text(`Date: ${formatDate(today)}`, right, y, { align: 'right' });
  y += 7;

  // Bill To box
  doc.setFillColor(...MUTED_BG);
  doc.roundedRect(margin, y - 4, 95, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('BILL TO', margin + 4, y);
  doc.setTextColor(...INK);
  doc.setFontSize(11);
  doc.text(customer?.name || order.customer_name || '—', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let by = y + 11;
  if (customer?.phone) { doc.text(`Phone: ${customer.phone}`, margin + 4, by); by += 5; }
  if (customer?.city) { doc.text(`City: ${customer.city}`, margin + 4, by); by += 5; }
  if (customer?.address) { doc.text(`Address: ${customer.address}`, margin + 4, by); by += 5; }

  // Delivery info box
  doc.setFillColor(...MUTED_BG);
  doc.roundedRect(right - 60, y - 4, 60, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('DELIVERY', right - 56, y);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(order.delivery_date)}`, right - 56, y + 6);
  doc.text(`Method: ${order.delivery_method || 'Pickup'}`, right - 56, y + 11);
  doc.text(`Priority: ${order.priority || 'Normal'}`, right - 56, y + 16);
  y += 26;

  // Order details
  sectionTitle(doc, 'Order Details', margin, y);
  y += 5;
  const details = [
    ['Order Type', order.order_type],
    ['Status', order.status],
    ['Booking Date', formatDate(order.booking_date)],
    ['Tailor', order.tailor_name || 'Unassigned'],
    ['Fabric', order.fabric_type ? `${order.fabric_type} (${order.fabric_quantity || 0}m)` : '—'],
    ['Supplier', order.supplier],
  ];
  const colW = (W - margin * 2) / 2;
  details.forEach(([k, v], i) => {
    kv(doc, k, v, margin + (i % 2) * colW, y + Math.floor(i / 2) * 6, 30);
  });
  y += Math.ceil(details.length / 2) * 6 + 4;

  // Measurements
  if (order.measurement_values && Object.keys(order.measurement_values).length) {
    sectionTitle(doc, `Measurements (${order.template_name || 'Standard'})`, margin, y);
    y += 5;
    const entries = Object.entries(order.measurement_values);
    const mColW = (W - margin * 2) / 4;
    entries.forEach(([k, v], i) => {
      const cx = margin + (i % 4) * mColW;
      const cy = y + Math.floor(i / 4) * 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(k, cx, cy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(String(v || '—'), cx, cy + 4);
    });
    y += Math.ceil(entries.length / 4) * 7 + 3;
  }

  // Pricing table
  sectionTitle(doc, 'Pricing Summary', margin, y);
  y += 5;
  hr(doc, margin, right, y);
  y += 5;
  const priceRows = [
    ['Fabric Cost', formatCurrency((order.fabric_cost || 0) * (order.fabric_quantity || 0))],
    ['Tailor Rate', formatCurrency(order.tailor_rate)],
    ['Markup', `${order.markup_percent || 0}%`],
    ['Discount', `- ${formatCurrency(order.discount)}`],
    ['Tax', `${order.tax_percent || 0}%`],
  ];
  priceRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(k, margin, y);
    doc.setTextColor(...INK);
    doc.text(v, right, y, { align: 'right' });
    y += 6;
  });
  hr(doc, margin, right, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total Amount', margin, y);
  doc.text(formatCurrency(order.total_amount), right, y, { align: 'right' });
  y += 8;

  // Payment history table
  if (payments.length) {
    sectionTitle(doc, 'Payment History', margin, y);
    y += 5;
    const cols = [95, 35, 40, right - 170];
    let x0 = margin;
    doc.setFillColor(...MUTED_BG);
    doc.rect(margin, y - 4, W - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    ['Date', 'Amount', 'Method', 'Type'].forEach((h, i) => {
      doc.text(h, x0 + [0, 95, 130, 170][i], y);
    });
    doc.setTextColor(...INK);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    payments.forEach((p) => {
      doc.text(formatDate(p.date), margin, y);
      doc.text(formatCurrency(p.amount), margin + 95, y);
      doc.text(p.payment_method || '—', margin + 130, y);
      doc.text(p.type || 'payment', margin + 170, y);
      y += 5;
    });
    y += 2;
  }

  // Paid / Balance summary
  hr(doc, margin, right, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...EMERALD);
  doc.text('Amount Paid', margin, y);
  doc.text(formatCurrency(order.amount_paid), right, y, { align: 'right' });
  y += 6;
  doc.setTextColor(...AMBER);
  doc.text('Balance Due', margin, y);
  doc.text(formatCurrency(order.balance_due), right, y, { align: 'right' });

  footer(doc, company);
  doc.save(`invoice-${orderRef}.pdf`);
}

// Generic list/table export
function exportList(filename, title, subtitle, columns, rows, totals) {
  const doc = newDoc();
  const W = 210, H = 297, margin = 14, right = W - margin, bottom = H - 24;
  let y = 36;

  brandHeader(doc, title.toUpperCase());

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(subtitle, margin, y);
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, right, y, { align: 'right' });
  doc.setTextColor(...INK);
  y += 8;

  // Column x positions based on equal share
  const colCount = columns.length;
  const tableW = W - margin * 2;
  const colW = tableW / colCount;
  const colX = columns.map((_, i) => margin + i * colW);

  // Header row
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y - 4, tableW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  columns.forEach((c, i) => {
    doc.text(String(c), colX[i] + 1.5, y, { align: c.align || 'left' });
  });
  doc.setTextColor(...INK);
  y += 5;

  // Body
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  let rowIdx = 0;
  rows.forEach((row) => {
    if (y > bottom) {
      footer(doc);
      doc.addPage();
      y = 36;
      doc.setFillColor(...PRIMARY);
      doc.rect(margin, y - 4, tableW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      columns.forEach((c, i) => doc.text(String(c), colX[i] + 1.5, y, { align: c.align || 'left' }));
      doc.setTextColor(...INK);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      rowIdx = 0;
    }
    if (rowIdx % 2 === 0) {
      doc.setFillColor(...MUTED_BG);
      doc.rect(margin, y - 4, tableW, 6, 'F');
    }
    columns.forEach((c, i) => {
      const val = row[c.key];
      const txt = c.format ? c.format(val) : (val == null ? '—' : String(val));
      doc.text(txt, c.align === 'right' ? colX[i] + colW - 1.5 : colX[i] + 1.5, y, { align: c.align || 'left' });
    });
    y += 6;
    rowIdx++;
  });

  if (totals && totals.length) {
    hr(doc, margin, right, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    totals.forEach(([label, value]) => {
      doc.setTextColor(...MUTED);
      doc.text(label, margin, y);
      doc.setTextColor(...INK);
      doc.text(value, right, y, { align: 'right' });
      y += 6;
    });
  }

  footer(doc);
  doc.save(filename);
}

export function exportOrdersPdf(orders) {
  exportList(
    'orders-export.pdf',
    'Orders Report',
    `${orders.length} orders`,
    [
      { key: 'order_id', label: 'Order ID' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'delivery_date', label: 'Delivery', format: formatDate },
      { key: 'payment_status', label: 'Payment' },
      { key: 'total_amount', label: 'Amount', align: 'right', format: formatCurrency },
    ],
    orders.map((o) => ({ ...o, order_id: o.order_id || o.id.slice(-6) })),
    [['Total Orders', String(orders.length)], ['Grand Total', formatCurrency(orders.reduce((s, o) => s + (o.total_amount || 0), 0))]]
  );
}

export function exportCustomersPdf(customers) {
  exportList(
    'customers-export.pdf',
    'Customers Report',
    `${customers.length} customers`,
    [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'city', label: 'City' },
      { key: 'total_orders', label: 'Orders', align: 'right' },
      { key: 'total_spent', label: 'Spent', align: 'right', format: formatCurrency },
      { key: 'outstanding_balance', label: 'Outstanding', align: 'right', format: formatCurrency },
      { key: 'status', label: 'Status' },
    ],
    customers,
    [['Total Customers', String(customers.length)], ['Total Outstanding', formatCurrency(customers.reduce((s, c) => s + (c.outstanding_balance || 0), 0))]]
  );
}

export function exportPaymentsPdf(payments) {
  exportList(
    'payments-export.pdf',
    'Payments Report',
    `${payments.length} transactions`,
    [
      { key: 'date', label: 'Date', format: formatDate },
      { key: 'order_ref', label: 'Order' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'payment_method', label: 'Method' },
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount', align: 'right', format: formatCurrency },
    ],
    payments,
    [['Total Collected', formatCurrency(payments.filter((p) => p.type !== 'refund').reduce((s, p) => s + (p.amount || 0), 0))]]
  );
}

// Build and optionally download an official Retail Tax Invoice for a Sale
export async function generateSaleInvoicePdf(sale, customer = null, autoDownload = false) {
  const company = await getCompany();
  const doc = newDoc();
  const W = 210, margin = 14, right = W - margin;
  let y = 36;

  brandHeader(doc, 'TAX INVOICE', company);

  const invoiceNo = sale.sale_id || (sale.id ? `INV-${sale.id.slice(-6).toUpperCase()}` : 'INV-0001');
  const now = new Date();
  const saleDate = sale.date || now.toISOString().slice(0, 10);
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Invoice Meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text(`Invoice No: ${invoiceNo}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`Date: ${formatDate(saleDate)}  ${timeStr}`, right, y, { align: 'right' });
  y += 8;

  // Customer Card
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
  const custAddress = customer?.address || customer?.city || '—';
  doc.text(`Phone: ${custPhone}   •   Email: ${custEmail}`, margin + 4, y + 10);
  doc.text(`Address: ${custAddress}`, margin + 4, y + 14);

  y += 26;

  // Items Table Header
  sectionTitle(doc, 'PURCHASED ITEMS', margin, y);
  y += 5;

  const tableW = W - margin * 2;
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y - 4, tableW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  const colX = {
    idx: margin + 3,
    desc: margin + 12,
    qty: margin + 110,
    price: margin + 140,
    total: right - 3,
  };

  doc.text('#', colX.idx, y);
  doc.text('Description', colX.desc, y);
  doc.text('Qty', colX.qty, y, { align: 'right' });
  doc.text('Unit Price', colX.price, y, { align: 'right' });
  doc.text('Total (AED)', colX.total, y, { align: 'right' });
  doc.setTextColor(...INK);
  y += 6;

  // Items Table Rows
  const items = sale.items || [];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  if (items.length === 0) {
    doc.text('Retail Sale', colX.desc, y);
    doc.text('1', colX.qty, y, { align: 'right' });
    doc.text(formatCurrency(sale.total), colX.price, y, { align: 'right' });
    doc.text(formatCurrency(sale.total), colX.total, y, { align: 'right' });
    y += 6;
  } else {
    items.forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(...MUTED_BG);
        doc.rect(margin, y - 4, tableW, 6, 'F');
      }
      doc.text(String(idx + 1), colX.idx, y);
      doc.text(item.name || `Item ${idx + 1}`, colX.desc, y);
      doc.text(String(item.quantity || 1), colX.qty, y, { align: 'right' });
      doc.text(formatCurrency(item.price || 0), colX.price, y, { align: 'right' });
      doc.text(formatCurrency(item.line_total || (item.price * (item.quantity || 1))), colX.total, y, { align: 'right' });
      y += 6;
    });
  }

  y += 4;
  hr(doc, margin, right, y);
  y += 6;

  // Summary box
  const summaryX = right - 75;
  const valX = right;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Subtotal:', summaryX, y);
  doc.setTextColor(...INK);
  doc.text(formatCurrency(sale.subtotal || sale.total), valX, y, { align: 'right' });
  y += 5;

  if (sale.discount > 0) {
    doc.setTextColor(...MUTED);
    doc.text('Discount:', summaryX, y);
    doc.setTextColor(...INK);
    doc.text(`-${formatCurrency(sale.discount)}`, valX, y, { align: 'right' });
    y += 5;
  }

  const taxAmt = sale.tax_amount || 0;
  doc.setTextColor(...MUTED);
  doc.text(`VAT (${sale.tax_percent || 5}%):`, summaryX, y);
  doc.setTextColor(...INK);
  doc.text(`+${formatCurrency(taxAmt)}`, valX, y, { align: 'right' });
  y += 6;

  hr(doc, summaryX, right, y - 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text('Grand Total:', summaryX, y + 3);
  doc.text(formatCurrency(sale.total), valX, y + 3, { align: 'right' });
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(...EMERALD);
  doc.text('Amount Paid:', summaryX, y);
  doc.text(formatCurrency(sale.amount_paid || sale.total), valX, y, { align: 'right' });
  y += 5;

  if (sale.balance_due > 0) {
    doc.setTextColor(...AMBER);
    doc.text('Balance Due:', summaryX, y);
    doc.text(formatCurrency(sale.balance_due), valX, y, { align: 'right' });
    y += 5;
  }

  // Payment method stamp
  const payBoxY = y - 26;
  doc.setFillColor(...MUTED_BG);
  doc.roundedRect(margin, payBoxY, 80, 24, 2, 2, 'F');
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, payBoxY, 80, 24, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text('PAYMENT DETAILS', margin + 4, payBoxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(`Method: ${sale.payment_method || 'Cash'}`, margin + 4, payBoxY + 11);
  const isPaid = (sale.amount_paid || 0) >= (sale.total || 0) || sale.payment_status === 'Paid';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(isPaid ? EMERALD : AMBER));
  doc.text(`Status: ${isPaid ? 'PAID IN FULL' : 'PARTIAL / PENDING'}`, margin + 4, payBoxY + 17);

  footer(doc, company);

  const filename = `invoice-${invoiceNo}.pdf`;
  if (autoDownload) {
    doc.save(filename);
  }

  return {
    doc,
    filename,
    dataUri: doc.output('datauristring'),
    blob: doc.output('blob'),
    download: () => doc.save(filename)
  };
}

export async function downloadSaleBill(sale, customer = null) {
  return generateSaleInvoicePdf(sale, customer, true);
}