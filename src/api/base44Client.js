// Persistent Local Database and Client for THREDO (Mehar Tailors)
// Provides full offline/local storage persistence across browser reloads
// and bridges with Base44 API / WhatsApp services.

const STORAGE_PREFIX = 'thredo_db_';

// Initial Seed Data
const DEFAULT_COMPANY = {
  id: 'comp-thredo',
  name: 'THREDO Tailoring & POS',
  legal_name: 'THREDO Garments & Tailoring LLC',
  registration_number: 'DXB-984210',
  address: 'Al Wasl Road, Al Satwa, Dubai, United Arab Emirates',
  phone: '+971 52 872 4090',
  email: 'contact@octapus.ae',
  whatsapp: '+971 52 872 4090',
  tax_number: '100234857200003',
  currency: 'AED',
  timezone: 'Asia/Dubai',
  logo_url: '',
  is_default: true,
  created_date: new Date().toISOString()
};

const DEFAULT_PRODUCTS = [
  { id: 'prod-1', name: 'Japanese Crepe Kandora Fabric', sku: 'FAB-JP01', category: 'Fabrics', price: 180, is_active: true, stock: 45, unit: 'meters', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-2', name: 'Italian Super 150s Wool Fabric', sku: 'FAB-IT150', category: 'Fabrics', price: 420, is_active: true, stock: 30, unit: 'meters', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-3', name: 'Pure Egyptian Giza Cotton', sku: 'FAB-EG90', category: 'Fabrics', price: 210, is_active: true, stock: 60, unit: 'meters', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-4', name: 'Bespoke 2-Piece Suit Tailoring', sku: 'TL-SUIT2P', category: 'Tailoring', price: 850, is_active: true, stock: 999, unit: 'piece', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-5', name: 'Traditional Emirati Kandora Stitching', sku: 'TL-KAND', category: 'Tailoring', price: 220, is_active: true, stock: 999, unit: 'piece', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-6', name: 'Custom Fitted Formal Shirt', sku: 'TL-SHIRT', category: 'Tailoring', price: 160, is_active: true, stock: 999, unit: 'piece', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-7', name: 'Pure Silk Tie — Midnight Navy', sku: 'ACC-TIE01', category: 'Accessories', price: 110, is_active: true, stock: 25, unit: 'piece', created_date: '2026-10-01T10:00:00Z' },
  { id: 'prod-8', name: 'Mother of Pearl Cufflinks Set', sku: 'ACC-CUFF01', category: 'Accessories', price: 150, is_active: true, stock: 18, unit: 'set', created_date: '2026-10-01T10:00:00Z' },
];

const DEFAULT_CUSTOMERS = [
  { id: 'cust-1', name: 'Rashid Al Nuaimi', phone: '+971 50 123 4567', whatsapp: '+971 50 123 4567', email: 'rashid@example.com', address: 'Villa 14, Jumeirah 2', city: 'Dubai', total_orders: 4, total_spent: 3420, outstanding_balance: 0, status: 'active', created_date: '2026-09-15T08:00:00Z' },
  { id: 'cust-2', name: 'Alex Hunter', phone: '+971 52 987 6543', whatsapp: '+971 52 987 6543', email: 'alex.hunter@example.com', address: 'Downtown Boulevard, Apt 1802', city: 'Dubai', total_orders: 2, total_spent: 1780, outstanding_balance: 350, status: 'active', created_date: '2026-09-20T09:30:00Z' },
  { id: 'cust-3', name: 'Salem Al Mansoori', phone: '+971 55 432 1098', whatsapp: '+971 55 432 1098', email: 'salem@example.com', address: 'Al Bateen', city: 'Abu Dhabi', total_orders: 5, total_spent: 4900, outstanding_balance: 0, status: 'active', created_date: '2026-09-25T11:00:00Z' },
  { id: 'cust-4', name: 'Fatima Al Zahra', phone: '+971 50 765 4321', whatsapp: '+971 50 765 4321', email: 'fatima@example.com', address: 'Al Majaz 3', city: 'Sharjah', total_orders: 1, total_spent: 650, outstanding_balance: 0, status: 'active', created_date: '2026-10-02T14:15:00Z' },
];

const DEFAULT_TAILORS = [
  { id: 'tl-1', name: 'Master Ahmed Al-Fayed', specialty: 'Cutting & Master Pattern', phone: '+971 50 111 2233', email: 'ahmed@thredo.ae', total_orders_assigned: 18, completed_orders: 16, tailor_rate: 140, active: true, created_date: '2026-08-01T08:00:00Z' },
  { id: 'tl-2', name: 'Tariq Mahmood', specialty: 'Kandora & Collar Finishing', phone: '+971 50 222 3344', email: 'tariq@thredo.ae', total_orders_assigned: 24, completed_orders: 22, tailor_rate: 90, active: true, created_date: '2026-08-05T08:00:00Z' },
  { id: 'tl-3', name: 'Farhan Ali', specialty: 'Bespoke Suits & Blazers', phone: '+971 50 333 4455', email: 'farhan@thredo.ae', total_orders_assigned: 15, completed_orders: 13, tailor_rate: 180, active: true, created_date: '2026-08-10T08:00:00Z' },
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl-1',
    name: 'Emirati Kandora',
    garment_type: 'Kandora',
    is_active: true,
    fields: [
      { name: 'Length', default_unit: 'in', required: true },
      { name: 'Shoulder', default_unit: 'in', required: true },
      { name: 'Sleeves', default_unit: 'in', required: true },
      { name: 'Neck / Collar', default_unit: 'in', required: true },
      { name: 'Chest', default_unit: 'in', required: true },
      { name: 'Waist', default_unit: 'in', required: false },
      { name: 'Bottom Flare', default_unit: 'in', required: false },
    ],
    created_date: '2026-08-01T08:00:00Z'
  },
  {
    id: 'tmpl-2',
    name: 'Bespoke 2-Piece Suit',
    garment_type: 'Suit',
    is_active: true,
    fields: [
      { name: 'Jacket Length', default_unit: 'in', required: true },
      { name: 'Chest', default_unit: 'in', required: true },
      { name: 'Waist', default_unit: 'in', required: true },
      { name: 'Shoulder Width', default_unit: 'in', required: true },
      { name: 'Sleeve Length', default_unit: 'in', required: true },
      { name: 'Trouser Length', default_unit: 'in', required: true },
      { name: 'Inseam', default_unit: 'in', required: true },
      { name: 'Thigh Width', default_unit: 'in', required: false },
    ],
    created_date: '2026-08-01T08:00:00Z'
  },
  {
    id: 'tmpl-3',
    name: 'Formal Shirt',
    garment_type: 'Shirt',
    is_active: true,
    fields: [
      { name: 'Collar', default_unit: 'in', required: true },
      { name: 'Chest', default_unit: 'in', required: true },
      { name: 'Waist', default_unit: 'in', required: true },
      { name: 'Shirt Length', default_unit: 'in', required: true },
      { name: 'Sleeve', default_unit: 'in', required: true },
      { name: 'Cuff', default_unit: 'in', required: false },
    ],
    created_date: '2026-08-01T08:00:00Z'
  }
];

const DEFAULT_SALES = [
  {
    id: 'sale-1001',
    sale_id: 'INV-2026-1001',
    customer_id: 'cust-1',
    customer_name: 'Rashid Al Nuaimi',
    customer_phone: '+971 50 123 4567',
    customer_email: 'rashid@example.com',
    items: [
      { product_id: 'prod-1', name: 'Japanese Crepe Kandora Fabric', price: 180, quantity: 4, line_total: 720 },
      { product_id: 'prod-5', name: 'Traditional Emirati Kandora Stitching', price: 220, quantity: 1, line_total: 220 }
    ],
    subtotal: 940,
    discount: 40,
    tax_percent: 5,
    tax_amount: 45,
    total: 945,
    amount_paid: 945,
    balance_due: 0,
    payment_method: 'Card',
    payment_status: 'Paid',
    date: '2026-10-12',
    status: 'Completed',
    bill_sent_whatsapp: true,
    whatsapp_status: 'sent',
    sent_to_number: '971501234567',
    sent_at: '2026-10-12T16:20:00Z',
    whatsapp_error: null,
    whatsapp_history: [
      { sent_at: '2026-10-12T16:20:00Z', number: '971501234567', status: 'sent', error: null }
    ],
    bill_sent_email: false,
    created_date: '2026-10-12T16:20:00Z'
  },
  {
    id: 'sale-1002',
    sale_id: 'INV-2026-1002',
    customer_id: 'cust-2',
    customer_name: 'Alex Hunter',
    customer_phone: '+971 52 987 6543',
    customer_email: 'alex.hunter@example.com',
    items: [
      { product_id: 'prod-7', name: 'Pure Silk Tie — Midnight Navy', price: 110, quantity: 2, line_total: 220 },
      { product_id: 'prod-8', name: 'Mother of Pearl Cufflinks Set', price: 150, quantity: 1, line_total: 150 }
    ],
    subtotal: 370,
    discount: 0,
    tax_percent: 5,
    tax_amount: 18.5,
    total: 388.5,
    amount_paid: 388.5,
    balance_due: 0,
    payment_method: 'Cash',
    payment_status: 'Paid',
    date: '2026-10-13',
    status: 'Completed',
    bill_sent_whatsapp: false,
    whatsapp_status: 'pending',
    sent_to_number: null,
    sent_at: null,
    whatsapp_error: null,
    whatsapp_history: [],
    bill_sent_email: false,
    created_date: '2026-10-13T01:15:00Z'
  }
];

const DEFAULT_ORDERS = [
  {
    id: 'ord-101',
    order_id: 'MH-2026-101',
    customer_id: 'cust-1',
    customer_name: 'Rashid Al Nuaimi',
    booking_date: '2026-10-10',
    delivery_date: '2026-10-18',
    priority: 'Normal',
    order_type: 'Standard',
    template_id: 'tmpl-1',
    template_name: 'Emirati Kandora',
    measurement_values: { Length: '58.5', Shoulder: '18.5', Sleeves: '25.0', 'Neck / Collar': '16.5', Chest: '42.0' },
    fabric_type: 'Japanese Crepe',
    fabric_quantity: 4,
    fabric_cost: 180,
    tailor_id: 'tl-2',
    tailor_name: 'Tariq Mahmood',
    tailor_rate: 90,
    subtotal: 810,
    total_amount: 850.5,
    amount_paid: 500,
    balance_due: 350.5,
    payment_status: 'Partial',
    status: 'Stitching',
    delivery_method: 'Pickup',
    created_date: '2026-10-10T11:00:00Z'
  }
];

// Helper: normalize phone number to international format
export function normalizePhoneNumber(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/[^0-9]/g, '');
  // UAE local mobile standard (starts with 05 -> converts to 9715)
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    cleaned = '971' + cleaned.substring(1);
  } else if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = '971' + cleaned;
  }
  return cleaned;
}

// Strict Phone Number Cleaner & Formatter as per requirements:
// 1. Remove spaces, "+", "-", brackets, and leading zeros.
// 2. Add the country code if it is missing.
// 3. Final format: digits only, international (example: 9715XXXXXXXX).
// 4. Validate the length (8 to 15 digits). If invalid, error: "Please enter a valid WhatsApp number".
export function formatWhatsAppNumber(phoneInput, countryCode = '971') {
  if (!phoneInput) {
    return {
      formatted: '',
      isValid: false,
      error: 'Please enter a valid WhatsApp number'
    };
  }

  // Country code digits only (e.g. "+971" -> "971")
  const countryDigits = String(countryCode || '971').replace(/[^0-9]/g, '');

  // 1. Remove spaces, "+", "-", brackets, and punctuation
  let raw = String(phoneInput).replace(/[\s+\-()_.]/g, '');

  // Remove leading zeros (e.g. 0501234567 -> 501234567, 00971... -> 971...)
  if (raw.startsWith('00')) {
    raw = raw.replace(/^00+/, '');
  } else if (raw.startsWith('0')) {
    raw = raw.replace(/^0+/, '');
  }

  // 2. Add the country code if it is missing
  let formatted = raw;
  if (!formatted.startsWith(countryDigits)) {
    formatted = countryDigits + formatted;
  }

  // 3. Final format: digits only, international (example: 9715XXXXXXXX)
  formatted = formatted.replace(/[^0-9]/g, '');

  // 4. Validate the length (8 to 15 digits)
  const isValid = formatted.length >= 8 && formatted.length <= 15;

  return {
    formatted,
    isValid,
    error: isValid ? '' : 'Please enter a valid WhatsApp number'
  };
}

const memoryStore = {
  Company: [DEFAULT_COMPANY],
  Product: [...DEFAULT_PRODUCTS],
  Customer: [...DEFAULT_CUSTOMERS],
  Tailor: [...DEFAULT_TAILORS],
  MeasurementTemplate: [...DEFAULT_TEMPLATES],
  Sale: [...DEFAULT_SALES],
  Order: [...DEFAULT_ORDERS],
  Payment: [],
  Expense: []
};

// Local Storage Helper
function getTable(table, defaultVal = []) {
  if (typeof window === 'undefined') {
    if (!memoryStore[table]) memoryStore[table] = defaultVal;
    return memoryStore[table];
  }
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table);
    if (!raw) {
      localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(defaultVal));
      return defaultVal;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[THREDO DB] Error reading ${table}:`, e);
    return defaultVal;
  }
}

function setTable(table, data) {
  if (typeof window === 'undefined') {
    memoryStore[table] = data;
    return;
  }
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data));
  } catch (e) {
    console.warn(`[THREDO DB] Error saving ${table}:`, e);
  }
}

// Initialise storage tables
function initStorage() {
  if (typeof window === 'undefined') return;
  const existingComp = getTable('Company', []);
  if (!existingComp.length || existingComp[0]?.name?.includes('Mehar')) {
    setTable('Company', [DEFAULT_COMPANY]);
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'Product')) setTable('Product', DEFAULT_PRODUCTS);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Customer')) setTable('Customer', DEFAULT_CUSTOMERS);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Tailor')) setTable('Tailor', DEFAULT_TAILORS);
  if (!localStorage.getItem(STORAGE_PREFIX + 'MeasurementTemplate')) setTable('MeasurementTemplate', DEFAULT_TEMPLATES);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Sale')) setTable('Sale', DEFAULT_SALES);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Order')) setTable('Order', DEFAULT_ORDERS);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Payment')) setTable('Payment', []);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Expense')) setTable('Expense', []);
  const existingCfg = getTable('WebsiteConfig', []);
  if (!existingCfg.length || existingCfg[0]?.title?.includes('Mehar')) {
    setTable('WebsiteConfig', [{
      id: 'cfg-1',
      enabled: true,
      auto_accept: false,
      title: 'THREDO Online Boutique',
      tagline: 'Bespoke tailoring and curated retail fabrics in Dubai.',
      garment_types: ['Emirati Kandora', 'Bespoke Suit', 'Formal Shirt', 'Trousers'],
      contact_phone: '+971 52 872 4090',
      contact_whatsapp: '+971 52 872 4090'
    }]);
  }
}

initStorage();

// Generic Entity CRUD Factory
function createEntityHandler(entityName) {
  return {
    async list(sort = '-created_date', limit = 100) {
      let items = getTable(entityName, []);
      if (sort) {
        const desc = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        items.sort((a, b) => {
          const va = a[field] ?? '';
          const vb = b[field] ?? '';
          return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
        });
      }
      return items.slice(0, limit);
    },

    async filter(query = {}, sort = '-created_date', limit = 100) {
      let items = getTable(entityName, []);
      let sortField = typeof sort === 'string' ? sort : (sort?.sort || '-created_date');
      let maxLimit = typeof limit === 'number' ? limit : (sort?.limit || 100);

      const filtered = items.filter((item) => {
        return Object.entries(query).every(([k, v]) => {
          if (v === undefined || v === null) return true;
          return item[k] === v;
        });
      });

      if (sortField) {
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        filtered.sort((a, b) => {
          const va = a[field] ?? '';
          const vb = b[field] ?? '';
          return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
        });
      }

      const res = filtered.slice(0, maxLimit);
      // Attach items property for backwards compatibility with code expecting .items
      res.items = res;
      return res;
    },

    async get(id) {
      const items = getTable(entityName, []);
      return items.find((x) => x.id === id || x.sale_id === id || x.order_id === id) || null;
    },

    async create(data) {
      const items = getTable(entityName, []);
      const newItem = {
        ...data,
        id: data.id || `${entityName.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`,
        created_date: data.created_date || new Date().toISOString()
      };
      items.unshift(newItem);
      setTable(entityName, items);
      return newItem;
    },

    async update(id, updates) {
      const items = getTable(entityName, []);
      const idx = items.findIndex((x) => x.id === id);
      if (idx === -1) {
        // if not found, create or return
        const created = await this.create({ id, ...updates });
        return created;
      }
      items[idx] = { ...items[idx], ...updates, updated_date: new Date().toISOString() };
      setTable(entityName, items);
      return items[idx];
    },

    async delete(id) {
      let items = getTable(entityName, []);
      items = items.filter((x) => x.id !== id);
      setTable(entityName, items);
      return { success: true };
    }
  };
}

// Proxied Entities Manager
const entitiesProxy = new Proxy({}, {
  get(target, prop) {
    if (typeof prop === 'string') {
      return createEntityHandler(prop);
    }
    return undefined;
  }
});

// Server Functions Invocation Mock & Logic
async function invokeFunction(name, params = {}) {
  if (name === 'sendSaleBill' || (name === 'sendWhatsAppInvoice' && (params.sale_id || !params.payment_id))) {
    const saleId = params.sale_id;
    const sales = getTable('Sale', []);
    const sale = sales.find((s) => s.id === saleId || s.sale_id === saleId);
    if (!sale) throw new Error('Sale not found');

    const customers = getTable('Customer', []);
    const customer = customers.find((c) => c.id === sale.customer_id) || null;

    // Phone number checking
    const countryCode = params.country_code || '971';
    const rawPhone = params.phone || sale.customer_phone || (customer?.phone) || '';
    const check = formatWhatsAppNumber(rawPhone, countryCode);

    if (!check.isValid) {
      const errReason = check.error || 'Please enter a valid WhatsApp number';
      const failEntry = {
        sent_at: new Date().toISOString(),
        number: check.formatted || rawPhone,
        status: 'failed',
        error: errReason
      };
      const updatedSale = {
        ...sale,
        whatsapp_status: 'failed',
        sent_to_number: check.formatted || rawPhone,
        whatsapp_error: errReason,
        whatsapp_history: [...(sale.whatsapp_history || []), failEntry]
      };
      const updatedSales = sales.map((s) => (s.id === sale.id ? updatedSale : s));
      setTable('Sale', updatedSales);

      return {
        success: false,
        error: errReason,
        whatsapp_status: 'failed',
        sale: updatedSale,
        whatsapp: { ok: false, error: errReason }
      };
    }

    const formattedPhone = check.formatted;

    // 1. Generate or reuse PDF invoice
    let pdfBase64 = sale.pdf_base64;
    let pdfDataUri = sale.pdf_url;
    if (!pdfBase64) {
      try {
        const { generateSaleInvoicePdf } = await import('../lib/pdf-utils.js');
        const pdfRes = await generateSaleInvoicePdf(sale, customer, false);
        if (pdfRes?.dataUri) {
          pdfDataUri = pdfRes.dataUri;
          const marker = 'base64,';
          const idx = pdfRes.dataUri.indexOf(marker);
          pdfBase64 = idx !== -1 ? pdfRes.dataUri.slice(idx + marker.length) : pdfRes.dataUri;
        }
      } catch (pdfErr) {
        console.warn('PDF generation note:', pdfErr);
      }
    }

    // 2. Prepare message text
    const invoiceNo = sale.sale_id || (sale.id ? `INV-${sale.id.slice(-6).toUpperCase()}` : 'INV-0001');
    const custDisplayName = sale.customer_name || customer?.name || 'Customer';
    const defaultMsg = `Hello ${custDisplayName}, your invoice ${invoiceNo} is attached.\nThank you for your purchase.`;
    const messageText = (params.custom_message !== undefined && params.custom_message !== null && params.custom_message !== '')
      ? params.custom_message
      : defaultMsg;

    // 3. Option: "Save this number to the customer record" (checkbox)
    if (params.update_customer_phone && sale.customer_id) {
      try {
        const custIdx = customers.findIndex((c) => c.id === sale.customer_id);
        if (custIdx !== -1) {
          customers[custIdx] = {
            ...customers[custIdx],
            phone: `+${formattedPhone}`,
            whatsapp: `+${formattedPhone}`,
            updated_date: new Date().toISOString()
          };
          setTable('Customer', customers);
        }
      } catch (custErr) {
        console.warn('Failed to update customer phone:', custErr);
      }
    }

    // 4. Send via WhatsApp Gateway (API key safely attached server-side by Vite proxy)
    let textSuccess = false;
    let mediaSuccess = false;
    let lastError = null;
    const gatewayBaseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:5173';

    // Step A: Send message text
    try {
      const textRes = await fetch(gatewayBaseUrl + '/api/gateway/send/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: formattedPhone,
          text: messageText,
          delay: 1000
        })
      });
      const textData = await textRes.json();
      if (textRes.ok && (textData.message === 'success' || textData.data)) {
        textSuccess = true;
      } else {
        lastError = textData.error || textData.message || 'Failed to send text message via gateway';
      }
    } catch (err) {
      lastError = err.message || 'Gateway text dispatch network error';
    }

    // Step B: Send PDF invoice document if available
    if (pdfBase64) {
      try {
        const mediaRes = await fetch(gatewayBaseUrl + '/api/gateway/send/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: formattedPhone,
            type: 'document',
            filename: `invoice-${invoiceNo}.pdf`,
            caption: `Invoice ${invoiceNo}`,
            url: pdfBase64
          })
        });
        const mediaData = await mediaRes.json();
        if (mediaRes.ok && (mediaData.message === 'success' || mediaData.data)) {
          mediaSuccess = true;
        } else if (!lastError) {
          lastError = mediaData.error || mediaData.message || 'Failed to send PDF document via gateway';
        }
      } catch (err) {
        if (!lastError) lastError = err.message || 'Gateway document dispatch network error';
      }
    }

    const overallSuccess = textSuccess || mediaSuccess;
    const finalStatus = overallSuccess ? 'sent' : 'failed';
    const historyEntry = {
      sent_at: new Date().toISOString(),
      number: formattedPhone,
      status: finalStatus,
      error: overallSuccess ? null : lastError
    };

    // Build fallback direct web link
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;

    // Update sale in DB
    const updatedSale = {
      ...sale,
      customer_phone: params.phone ? rawPhone : sale.customer_phone,
      whatsapp_status: finalStatus,
      sent_to_number: formattedPhone,
      sent_at: historyEntry.sent_at,
      whatsapp_error: overallSuccess ? null : lastError,
      whatsapp_history: [...(sale.whatsapp_history || []), historyEntry],
      bill_sent_whatsapp: overallSuccess ? true : sale.bill_sent_whatsapp,
      pdf_base64: pdfBase64 || sale.pdf_base64,
      pdf_url: pdfDataUri || sale.pdf_url
    };

    const updatedSales = sales.map((s) => (s.id === sale.id ? updatedSale : s));
    setTable('Sale', updatedSales);

    return {
      success: overallSuccess,
      whatsapp_status: finalStatus,
      formatted_number: formattedPhone,
      error: overallSuccess ? null : lastError,
      sale: updatedSale,
      sale_id: sale.sale_id,
      whatsapp: {
        ok: overallSuccess,
        phone: formattedPhone,
        url: waUrl,
        text_sent: textSuccess,
        media_sent: mediaSuccess,
        error: lastError
      }
    };
  }

  if (name === 'sendWhatsAppInvoice') {
    const paymentId = params.payment_id;
    const payments = getTable('Payment', []);
    const payment = payments.find((p) => p.id === paymentId);
    const orders = getTable('Order', []);
    const order = orders.find((o) => o.id === payment?.order_id) || {};
    const customers = getTable('Customer', []);
    const customer = customers.find((c) => c.id === payment?.customer_id || c.id === order?.customer_id) || {};

    const rawPhone = customer.whatsapp || customer.phone || '';
    const normPhone = normalizePhoneNumber(rawPhone);

    return {
      success: true,
      whatsapp: {
        ok: true,
        phone: normPhone,
        message_id: `wa-order-${Date.now()}`
      }
    };
  }

  if (name === 'getOnlineOrderingConfig') {
    const company = (getTable('Company', []) || [])[0] || DEFAULT_COMPANY;
    const config = (getTable('WebsiteConfig', []) || [])[0] || {};
    const products = getTable('Product', []);
    return {
      data: {
        company,
        config,
        products: products.filter((p) => p.is_active)
      }
    };
  }

  if (name === 'submitOnlineOrder') {
    return { success: true };
  }

  return { success: true };
}

// Current User Session
const activeUser = {
  id: 'usr-admin-1',
  name: 'Alex / CEO Octapus',
  email: 'admin@octapus.ae',
  role: 'admin'
};

// Exported Primary DB Client
export const db = {
  auth: {
    async isAuthenticated() {
      return true;
    },
    async me() {
      return activeUser;
    },
    async loginViaEmailPassword(email, password) {
      return activeUser;
    },
    async loginWithProvider(provider, returnTo) {
      if (typeof window !== 'undefined') window.location.href = returnTo || '/';
      return activeUser;
    },
    async logout(redirectUrl) {
      if (typeof window !== 'undefined') window.location.reload();
      return true;
    },
    redirectToLogin(returnTo) {
      if (typeof window !== 'undefined') window.location.href = '/';
    }
  },
  entities: entitiesProxy,
  asServiceRole: {
    entities: entitiesProxy,
    integrations: {
      Core: {
        async UploadFile() {
          return { file_url: '' };
        },
        async SendEmail() {
          return { ok: true };
        }
      }
    }
  },
  functions: {
    invoke: invokeFunction
  },
  integrations: {
    Core: {
      async UploadFile() {
        return { file_url: '' };
      },
      async SendEmail() {
        return { ok: true };
      }
    }
  }
};

// Expose globally for legacy inline file scripts
if (typeof window !== 'undefined') {
  window.__B44_DB__ = db;
}
if (typeof globalThis !== 'undefined') {
  globalThis.__B44_DB__ = db;
}

export const base44 = db;
export default db;