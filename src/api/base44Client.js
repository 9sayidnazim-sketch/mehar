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
  { id: 'tl-1', name: 'Master Ahmed Al-Fayed', specialization: 'Cutting & Master Pattern', specialty: 'Cutting & Master Pattern', department: 'Workshop', phone: '+971 50 111 2233', email: 'ahmed@thredo.ae', total_orders_assigned: 18, completed_orders: 16, rate: 140, tailor_rate: 140, active: true, created_date: '2026-08-01T08:00:00Z' },
  { id: 'tl-2', name: 'Tariq Mahmood', specialization: 'Kandora & Collar Finishing', specialty: 'Kandora & Collar Finishing', department: 'Workshop', phone: '+971 50 222 3344', email: 'tariq@thredo.ae', total_orders_assigned: 24, completed_orders: 22, rate: 90, tailor_rate: 90, active: true, created_date: '2026-08-05T08:00:00Z' },
  { id: 'tl-3', name: 'Farhan Ali', specialization: 'Bespoke Suits & Blazers', specialty: 'Bespoke Suits & Blazers', department: 'Workshop', phone: '+971 50 333 4455', email: 'farhan@thredo.ae', total_orders_assigned: 15, completed_orders: 13, rate: 180, tailor_rate: 180, active: true, created_date: '2026-08-10T08:00:00Z' },
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl-1',
    name: 'Emirati Kandora',
    category: 'Men',
    garment_type: 'Kandora',
    is_active: true,
    fields: [
      { field_name: 'Length', name: 'Length', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Shoulder', name: 'Shoulder', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Sleeves', name: 'Sleeves', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Neck / Collar', name: 'Neck / Collar', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Chest', name: 'Chest', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Waist', name: 'Waist', unit: 'in', default_unit: 'in', is_required: false, required: false, show_in_quick_view: true },
      { field_name: 'Bottom Flare', name: 'Bottom Flare', unit: 'in', default_unit: 'in', is_required: false, required: false, show_in_quick_view: false },
    ],
    created_date: '2026-08-01T08:00:00Z'
  },
  {
    id: 'tmpl-2',
    name: 'Bespoke 2-Piece Suit',
    category: 'Men',
    garment_type: 'Suit',
    is_active: true,
    fields: [
      { field_name: 'Jacket Length', name: 'Jacket Length', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Chest', name: 'Chest', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Waist', name: 'Waist', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Shoulder Width', name: 'Shoulder Width', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Sleeve Length', name: 'Sleeve Length', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Trouser Length', name: 'Trouser Length', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Inseam', name: 'Inseam', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Thigh Width', name: 'Thigh Width', unit: 'in', default_unit: 'in', is_required: false, required: false, show_in_quick_view: false },
    ],
    created_date: '2026-08-01T08:00:00Z'
  },
  {
    id: 'tmpl-3',
    name: 'Formal Shirt',
    category: 'Men',
    garment_type: 'Shirt',
    is_active: true,
    fields: [
      { field_name: 'Collar', name: 'Collar', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Chest', name: 'Chest', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Waist', name: 'Waist', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Shirt Length', name: 'Shirt Length', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Sleeve', name: 'Sleeve', unit: 'in', default_unit: 'in', is_required: true, required: true, show_in_quick_view: true },
      { field_name: 'Cuff', name: 'Cuff', unit: 'in', default_unit: 'in', is_required: false, required: false, show_in_quick_view: false },
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
// 1. Remove spaces, "+", "-", brackets, and punctuation.
import { parsePhoneNumberWithError } from 'libphonenumber-js';

// Customer WhatsApp Number Validation with maintained phone library (libphonenumber-js):
// 1. Must NOT silently assume a country code.
// 2. Requires explicit international country code.
// 3. Final format: digits only, international (example: 9715XXXXXXXX or 639XXXXXXXXX).
export function formatWhatsAppNumber(phoneInput, explicitCountryCode = '') {
  if (!phoneInput) {
    return {
      formatted: '',
      isValid: false,
      error: 'Please enter a valid WhatsApp number'
    };
  }

  const raw = String(phoneInput).trim();
  const startsWithDomesticZero = /^0[1-9]/.test(raw.replace(/[\s+\-()_.]/g, ''));
  if (startsWithDomesticZero && !explicitCountryCode) {
    return {
      formatted: '',
      isValid: false,
      error: 'Number starts with domestic 0. Please specify an explicit international country code (e.g. +971 or +63). Do not assume a country.'
    };
  }

  const countryDigits = explicitCountryCode ? String(explicitCountryCode).replace(/[^0-9]/g, '') : '';
  let cleaned = raw.replace(/[\s+\-()_.]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.replace(/^00+/, '');
  if (startsWithDomesticZero && countryDigits) {
    cleaned = cleaned.replace(/^0+/, '');
  }

  let full = cleaned;
  if (countryDigits && !full.startsWith(countryDigits)) {
    full = countryDigits + full;
  }
  if (!full.startsWith('+')) {
    full = '+' + full;
  }

  try {
    const parsed = parsePhoneNumberWithError(full);
    if (!parsed || !parsed.isValid()) {
      return {
        formatted: '',
        isValid: false,
        error: 'Please enter a valid WhatsApp number with country code'
      };
    }
    const digits = `${parsed.countryCallingCode}${parsed.nationalNumber}`;
    return {
      formatted: digits,
      displayFormatted: parsed.formatInternational(),
      isValid: true,
      country: parsed.country,
      error: ''
    };
  } catch (err) {
    return {
      formatted: '',
      isValid: false,
      error: 'Please enter a valid WhatsApp number with country code'
    };
  }
}

const DEFAULT_PAYMENTS = [
  {
    id: 'pay-101',
    order_id: 'ord-101',
    order_ref: 'MH-2026-101',
    customer_id: 'cust-1',
    customer_name: 'Rashid Al Nuaimi',
    amount: 500,
    payment_method: 'Card',
    date: '2026-10-10',
    reference_number: 'CARD-TXN-8821',
    notes: 'Advance booking payment',
    type: 'advance',
    created_date: '2026-10-10T11:05:00Z'
  },
  {
    id: 'pay-1001',
    order_id: 'sale-1001',
    order_ref: 'INV-2026-1001',
    customer_id: 'cust-1',
    customer_name: 'Rashid Al Nuaimi',
    amount: 945,
    payment_method: 'Card',
    date: '2026-10-12',
    reference_number: 'POS-TXN-1001',
    notes: 'Retail POS Sale INV-2026-1001',
    type: 'payment',
    created_date: '2026-10-12T16:20:00Z'
  },
  {
    id: 'pay-1002',
    order_id: 'sale-1002',
    order_ref: 'INV-2026-1002',
    customer_id: 'cust-2',
    customer_name: 'Alex Hunter',
    amount: 388.5,
    payment_method: 'Cash',
    date: '2026-10-13',
    reference_number: 'POS-TXN-1002',
    notes: 'Retail POS Sale INV-2026-1002',
    type: 'payment',
    created_date: '2026-10-13T01:15:00Z'
  }
];

const memoryStore = {
  Company: [DEFAULT_COMPANY],
  Product: [...DEFAULT_PRODUCTS],
  Customer: [...DEFAULT_CUSTOMERS],
  Tailor: [...DEFAULT_TAILORS],
  MeasurementTemplate: [...DEFAULT_TEMPLATES],
  Sale: [...DEFAULT_SALES],
  Order: [...DEFAULT_ORDERS],
  Payment: [...DEFAULT_PAYMENTS],
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
    window.dispatchEvent(new CustomEvent('thredo-db-updated', { detail: { table, action: 'write' } }));
  } catch (e) {
    console.warn(`[THREDO DB] Error saving ${table}:`, e);
  }
}

// Initialise storage tables
export function initStorage(force = false) {
  if (typeof window === 'undefined') return;

  if (force) {
    setTable('Company', [DEFAULT_COMPANY]);
    setTable('Product', DEFAULT_PRODUCTS);
    setTable('Customer', DEFAULT_CUSTOMERS);
    setTable('Tailor', DEFAULT_TAILORS);
    setTable('MeasurementTemplate', DEFAULT_TEMPLATES);
    setTable('Sale', DEFAULT_SALES);
    setTable('Order', DEFAULT_ORDERS);
    setTable('Payment', DEFAULT_PAYMENTS);
    setTable('Expense', []);
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
    return;
  }

  const existingComp = getTable('Company', []);
  if (!existingComp.length || existingComp[0]?.name?.includes('Mehar')) {
    setTable('Company', [DEFAULT_COMPANY]);
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'Product')) setTable('Product', DEFAULT_PRODUCTS);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Customer')) setTable('Customer', DEFAULT_CUSTOMERS);
  
  const existingTailors = getTable('Tailor', []);
  if (!existingTailors.length || !existingTailors[0]?.specialization) {
    setTable('Tailor', DEFAULT_TAILORS);
  }

  const existingTemplates = getTable('MeasurementTemplate', []);
  if (!existingTemplates.length || !existingTemplates[0]?.fields?.[0]?.field_name) {
    setTable('MeasurementTemplate', DEFAULT_TEMPLATES);
  }

  if (!localStorage.getItem(STORAGE_PREFIX + 'Sale')) setTable('Sale', DEFAULT_SALES);
  if (!localStorage.getItem(STORAGE_PREFIX + 'Order')) setTable('Order', DEFAULT_ORDERS);

  const existingPayments = getTable('Payment', []);
  if (!existingPayments.length) {
    setTable('Payment', DEFAULT_PAYMENTS);
  }

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

// Full Database Reset / Seed Refresh
export function resetDatabase() {
  if (typeof window === 'undefined') {
    memoryStore.Company = [DEFAULT_COMPANY];
    memoryStore.Product = [...DEFAULT_PRODUCTS];
    memoryStore.Customer = [...DEFAULT_CUSTOMERS];
    memoryStore.Tailor = [...DEFAULT_TAILORS];
    memoryStore.MeasurementTemplate = [...DEFAULT_TEMPLATES];
    memoryStore.Sale = [...DEFAULT_SALES];
    memoryStore.Order = [...DEFAULT_ORDERS];
    memoryStore.Payment = [...DEFAULT_PAYMENTS];
    memoryStore.Expense = [];
    return { success: true };
  }
  try {
    const tables = ['Company', 'Product', 'Customer', 'Tailor', 'MeasurementTemplate', 'Sale', 'Order', 'Payment', 'Expense', 'WebsiteConfig'];
    tables.forEach((t) => localStorage.removeItem(STORAGE_PREFIX + t));
    initStorage(true);
    window.dispatchEvent(new CustomEvent('thredo-db-updated', { detail: { table: 'all', reset: true } }));
    return { success: true };
  } catch (err) {
    console.error('[THREDO DB] Reset error:', err);
    return { success: false, error: err.message };
  }
}

// Database manual refresh trigger
export function refreshDatabase(tableName = 'all') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('thredo-db-updated', { detail: { table: tableName, manual: true } }));
}

// Subscribe to database updates (works across tabs and components)
export function onDbUpdate(tables = [], callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => {
    const updatedTable = e.detail?.table;
    if (!tables.length || updatedTable === 'all' || tables.includes(updatedTable)) {
      callback(e.detail);
    }
  };
  window.addEventListener('thredo-db-updated', handler);
  return () => window.removeEventListener('thredo-db-updated', handler);
}

// Cross-tab synchronization via native storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(STORAGE_PREFIX)) {
      const table = e.key.replace(STORAGE_PREFIX, '');
      window.dispatchEvent(new CustomEvent('thredo-db-updated', { detail: { table, action: 'cross-tab-sync' } }));
    }
  });
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
  if (name === 'sendSaleBill' || name === 'sendWhatsAppInvoice') {
    const saleId = params.sale_id || params.order_id || params.invoice_id;
    const sales = getTable('Sale', []);
    let sale = sales.find((s) => s.id === saleId || s.sale_id === saleId) || null;

    if (!sale && params.order_id) {
      const orders = getTable('Order', []);
      const order = orders.find((o) => o.id === params.order_id || o.order_id === params.order_id);
      if (order) {
        sale = {
          id: order.id,
          sale_id: order.order_id || `ORD-${order.id.slice(-6)}`,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          items: [{ name: order.template_name || 'Tailored Garment', price: order.total_amount || 0, quantity: 1, line_total: order.total_amount || 0 }],
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
    }

    if (params.phone) {
      sale = { ...sale, customer_phone: params.phone };
    }

    if (!sale) {
      throw new Error('Invoice or order not found');
    }

    // Call protected backend endpoint with unique idempotency key
    const idempotencyKey = params.idempotency_key || `idem-${sale.id}-${Date.now()}`;
    const baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:5173';

    try {
      const res = await fetch(baseUrl + '/api/invoices/send-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer usr-admin-1'
        },
        body: JSON.stringify({
          invoice_id: sale.id,
          idempotency_key: idempotencyKey,
          preview_recipient: params.preview_recipient || params.preview_phone || null,
          allow_resend: Boolean(params.allow_resend || params.confirm_resend),
          invoice_data: sale
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.duplicate_prevented) {
        return {
          success: false,
          duplicate_prevented: true,
          status: data.existing_status || 'submitted',
          error: data.error,
          history: data.history || [],
          sale
        };
      }

      if (res.status === 409 && data.phone_changed) {
        return {
          success: false,
          phone_changed: true,
          error: data.error,
          current_destination: data.current_destination,
          sale
        };
      }

      const isSuccess = res.ok && data.success;
      const historyEntry = {
        sent_at: data.sent_at || new Date().toISOString(),
        number: data.destination_number || sale.customer_phone || '',
        status: isSuccess ? (data.status || 'submitted') : (data.status || 'failed'),
        message_id: data.message_id || null,
        error: isSuccess ? null : (data.error || 'Dispatch failed'),
        idempotency_key: idempotencyKey
      };

      const updatedSale = {
        ...sale,
        whatsapp_status: isSuccess ? (data.status || 'submitted') : (data.status || 'failed'),
        sent_to_number: data.destination_number ? data.destination_number.replace(/^\+/, '') : (sale.sent_to_number || null),
        sent_at: historyEntry.sent_at,
        whatsapp_message_id: data.message_id || sale.whatsapp_message_id || null,
        whatsapp_error: isSuccess ? null : (data.error || null),
        whatsapp_history: [...(sale.whatsapp_history || []), historyEntry],
        bill_sent_whatsapp: isSuccess ? true : sale.bill_sent_whatsapp,
      };

      const updatedSales = sales.map((s) => (s.id === sale.id ? updatedSale : s));
      setTable('Sale', updatedSales);

      if (params.order_id) {
        const orders = getTable('Order', []);
        const updatedOrders = orders.map((o) => (o.id === params.order_id || o.order_id === params.order_id ? {
          ...o,
          whatsapp_status: isSuccess ? (data.status || 'submitted') : (data.status || 'failed'),
          sent_to_number: data.destination_number ? data.destination_number.replace(/^\+/, '') : (o.sent_to_number || null),
          sent_at: historyEntry.sent_at,
          whatsapp_message_id: data.message_id || o.whatsapp_message_id || null,
          whatsapp_error: isSuccess ? null : (data.error || null),
          whatsapp_history: [...(o.whatsapp_history || []), historyEntry],
          bill_sent_whatsapp: isSuccess ? true : o.bill_sent_whatsapp
        } : o));
        setTable('Order', updatedOrders);
      }

      return {
        success: isSuccess,
        status: updatedSale.whatsapp_status,
        formatted_number: data.destination_number,
        message_id: data.message_id,
        pairing_needed: Boolean(data.pairing_needed),
        customer_number_invalid: Boolean(data.customer_number_invalid),
        error: isSuccess ? null : data.error,
        sale: updatedSale,
        sale_id: sale.sale_id,
        whatsapp: {
          ok: isSuccess,
          status: updatedSale.whatsapp_status,
          message_id: data.message_id,
          phone: data.destination_number,
          pairing_needed: Boolean(data.pairing_needed),
          error: data.error
        }
      };
    } catch (err) {
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Invoice service communication error',
        sale,
        whatsapp: { ok: false, error: err.message }
      };
    }
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
    const { type, customer, tailoring, retail } = params || {};
    let refId = '';
    if (type === 'tailoring') {
      refId = `ONL-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOrder = {
        id: `ord-onl-${Date.now()}`,
        order_id: refId,
        customer_name: customer?.name || 'Online Customer',
        customer_phone: customer?.phone || customer?.whatsapp || '',
        customer_email: customer?.email || '',
        booking_date: new Date().toISOString().slice(0, 10),
        delivery_date: tailoring?.delivery_date || '',
        priority: 'Normal',
        order_type: 'Standard',
        template_name: tailoring?.garment_type || 'Custom Garment',
        fabric_type: tailoring?.fabric_preference || '',
        style_notes: tailoring?.notes || '',
        measurement_values: tailoring?.measurements ? { notes: tailoring.measurements } : {},
        status: 'Booked',
        payment_status: 'Pending',
        amount_paid: 0,
        subtotal: 0,
        total_amount: 0,
        balance_due: 0,
        source: 'online',
        online_pending: true,
        delivery_method: customer?.delivery_method || 'Pickup',
        created_date: new Date().toISOString()
      };
      const orders = getTable('Order', []);
      orders.unshift(newOrder);
      setTable('Order', orders);
    } else {
      refId = `ONL-INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const items = retail?.items || [];
      const subtotal = items.reduce((s, i) => s + (i.line_total || (i.price || 0) * (i.quantity || 1)), 0);
      const newSale = {
        id: `sale-onl-${Date.now()}`,
        sale_id: refId,
        customer_name: customer?.name || 'Online Customer',
        customer_phone: customer?.phone || customer?.whatsapp || '',
        customer_email: customer?.email || '',
        items,
        subtotal,
        discount: 0,
        tax_percent: 5,
        tax_amount: subtotal * 0.05,
        total: subtotal * 1.05,
        amount_paid: 0,
        balance_due: subtotal * 1.05,
        payment_method: 'Card',
        payment_status: 'Pending',
        date: new Date().toISOString().slice(0, 10),
        status: 'Completed',
        source: 'online',
        online_pending: true,
        created_date: new Date().toISOString()
      };
      const sales = getTable('Sale', []);
      sales.unshift(newSale);
      setTable('Sale', sales);
    }
    return {
      success: true,
      data: {
        reference: refId,
        review: true
      }
    };
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
  },
  resetDatabase,
  refresh: refreshDatabase,
  refreshDatabase,
  onDbUpdate
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