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

// Local Storage Helper
function getTable(table, defaultVal = []) {
  if (typeof window === 'undefined') return defaultVal;
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
  if (typeof window === 'undefined') return;
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
  if (name === 'sendSaleBill') {
    const saleId = params.sale_id;
    const sales = getTable('Sale', []);
    const sale = sales.find((s) => s.id === saleId || s.sale_id === saleId);
    if (!sale) throw new Error('Sale not found');

    const rawPhone = sale.customer_phone || '';
    const normPhone = normalizePhoneNumber(rawPhone);
    if (!normPhone || normPhone.length < 8) {
      return {
        success: false,
        whatsapp: { ok: false, error: 'Customer phone is invalid or missing WhatsApp format.' }
      };
    }

    // Mark as sent in DB
    const updatedSales = sales.map((s) => (s.id === sale.id ? { ...s, bill_sent_whatsapp: true } : s));
    setTable('Sale', updatedSales);

    // Build WhatsApp chat link
    const company = (getTable('Company', []) || [])[0] || DEFAULT_COMPANY;
    const textMsg = encodeURIComponent(
      `Hello ${sale.customer_name || 'Customer'},\n` +
      `Thank you for your purchase at ${company.name}!\n\n` +
      `🧾 Invoice No: ${sale.sale_id}\n` +
      `💰 Total: AED ${Number(sale.total || 0).toFixed(2)}\n` +
      `💳 Paid: AED ${Number(sale.amount_paid || 0).toFixed(2)}\n` +
      (sale.balance_due > 0 ? `⚠️ Balance Due: AED ${Number(sale.balance_due || 0).toFixed(2)}\n` : '') +
      `\nYour official PDF tax invoice has been generated. Thank you!`
    );
    const waUrl = `https://wa.me/${normPhone}?text=${textMsg}`;

    // Optionally notify Orbit or dev bridge if running
    try {
      fetch('http://localhost:3000/send/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: normPhone, text: decodeURIComponent(textMsg) })
      }).catch(() => {});
    } catch (_) {}

    return {
      success: true,
      sale_id: sale.sale_id,
      whatsapp: {
        ok: true,
        phone: normPhone,
        url: waUrl,
        message_id: `wa-msg-${Date.now()}`
      },
      email: { skipped: true, reason: 'Email delivery optional' }
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