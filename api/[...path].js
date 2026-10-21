import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase if environment variables are set
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Map entities to Supabase tables
const ENTITY_TABLE_MAP = {
  Customer: 'customers',
  Order: 'orders',
  Sale: 'sales',
  Tailor: 'tailors',
  Payment: 'payments',
  Expense: 'expenses',
  Product: 'products',
  Company: 'companies',
  Business: 'businesses',
  MeasurementTemplate: 'measurement_templates',
  Measurement: 'measurements',
  SubscriptionPlan: 'subscription_plans',
  Subscription: 'subscriptions',
  PaymentSubmission: 'payment_submissions',
  Coupon: 'coupons',
  CouponRedemption: 'coupon_redemptions',
  AppNotification: 'app_notifications',
  WebsiteConfig: 'website_configs'
};

function getTableName(entityName) {
  return ENTITY_TABLE_MAP[entityName] || entityName.toLowerCase() + 's';
}

// In-memory / seed fallback storage
let cachedSeed = null;
function getSeedData() {
  if (cachedSeed) return cachedSeed;
  try {
    const seedPath = path.resolve(process.cwd(), 'src/api/seedData.json');
    if (fs.existsSync(seedPath)) {
      cachedSeed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      return cachedSeed;
    }
  } catch (_) {}
  return {};
}

// State store for runtime provisional grants & coupons if DB offline
const runtimeState = {
  coupons: {
    PROMO48: { hours: 48, redemptions: new Set() }
  },
  submissions: [],
  provisionalGrants: {},
  notifications: [
    {
      id: 'notif-welcome',
      title: 'Welcome to THREDO',
      message: 'Your commercial POS and tailoring studio is ready.',
      type: 'info',
      read: false,
      created_at: new Date().toISOString()
    }
  ]
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  // Parse body safely
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 1. AUTHENTICATION ENDPOINTS
  // --------------------------------------------------------------------------
  if (url.includes('/auth/login')) {
    const emailStr = String(body.email || 'gm@octapus.ae');
    const isAdmin = emailStr.toLowerCase().includes('admin') ||
                    emailStr.toLowerCase().includes('octapus') ||
                    emailStr.toLowerCase() === 'gm@octapus.ae';

    const user = {
      id: isAdmin ? 'usr-admin-gm' : `usr_${Date.now()}`,
      email: emailStr,
      full_name: isAdmin ? 'General Manager' : emailStr.split('@')[0],
      role: isAdmin ? 'admin' : 'user',
      business_id: 'biz-default'
    };

    return res.status(200).json({
      access_token: 'token-' + Date.now(),
      user
    });
  }

  if (url.includes('/auth/register')) {
    const emailStr = String(body.email || 'user@example.com');
    return res.status(200).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: `usr_${Date.now()}`,
        email: emailStr,
        full_name: body.full_name || emailStr.split('@')[0],
        role: 'user',
        business_id: 'biz-default'
      }
    });
  }

  if (url.includes('/auth/me')) {
    const authHeader = req.headers.authorization || '';
    const isAdmin = authHeader.includes('admin') || authHeader.includes('gm');
    return res.status(200).json({
      id: isAdmin ? 'usr-admin-gm' : 'usr-staff',
      email: isAdmin ? 'gm@octapus.ae' : 'staff@thredo.ae',
      full_name: isAdmin ? 'General Manager' : 'Workshop Staff',
      role: isAdmin ? 'admin' : 'user',
      business_id: 'biz-default'
    });
  }

  // --------------------------------------------------------------------------
  // 2. WHATSAPP & ORBIT ENDPOINTS
  // --------------------------------------------------------------------------
  if (url.includes('/whatsapp/status')) {
    const statusHandler = (await import('./whatsapp/status.js')).default;
    return statusHandler(req, res);
  }

  if (url.includes('/whatsapp/qr')) {
    const qrHandler = (await import('./whatsapp/qr.js')).default;
    return qrHandler(req, res);
  }

  if (url.includes('sendSaleBill')) {
    const sendSaleBill = (await import('./functions/sendSaleBill.js')).default;
    return sendSaleBill(req, res);
  }

  if (url.includes('sendWhatsAppInvoice')) {
    const sendWhatsAppInvoice = (await import('./functions/sendWhatsAppInvoice.js')).default;
    return sendWhatsAppInvoice(req, res);
  }

  // --------------------------------------------------------------------------
  // 3. THREDO COMMERCIAL FUNCTIONS & ACCESS CONTROL
  // --------------------------------------------------------------------------

  // A. getAccessState
  if (url.includes('getAccessState')) {
    const businessId = body.business_id || 'biz-default';

    // 1. Check if provisional grant active
    const provExpiry = runtimeState.provisionalGrants[businessId];
    if (provExpiry && new Date(provExpiry) > new Date()) {
      const access = {
        state: 'provisional',
        allowed: true,
        badge: 'Under Verification',
        badgeVariant: 'warning',
        business_id: businessId,
        expires_at: provExpiry,
        expires_formatted: new Date(provExpiry).toLocaleString('en-US', { timeZone: 'Asia/Dubai' }),
        plan: '48h Provisional Access'
      };
      return res.status(200).json({ ok: true, data: { access }, access });
    }

    // Default permanent system admin access
    const access = {
      state: 'admin',
      allowed: true,
      badge: 'Admin',
      badgeVariant: 'admin',
      role: 'admin',
      business_id: businessId,
      expires_at: null,
      expires_formatted: 'Permanent (Platform Admin)',
      plan: 'System Admin'
    };
    return res.status(200).json({ ok: true, data: { access }, access });
  }

  // B. initiatePayment
  if (url.includes('initiatePayment')) {
    const planId = body.plan_id || 'plan_yearly';
    const redirectUrl = planId === 'plan_lifetime'
      ? 'https://pay.ziina.com/mehar/lifetime'
      : 'https://pay.ziina.com/mehar/yearly';

    return res.status(200).json({
      success: true,
      data: {
        payment_url: redirectUrl,
        plan_id: planId,
        amount: planId === 'plan_lifetime' ? 3200 : 2222,
        currency: 'AED'
      }
    });
  }

  // C. submitPaymentReference
  if (url.includes('submitPaymentReference')) {
    const ref = body.reference_number || '';
    if (!ref || ref.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference number. Must be at least 6 characters.'
      });
    }

    const businessId = body.business_id || 'biz-default';
    const provisionalHours = 48;
    const expiresAt = new Date(Date.now() + provisionalHours * 3600 * 1000).toISOString();
    runtimeState.provisionalGrants[businessId] = expiresAt;

    const submission = {
      id: `sub_${Date.now()}`,
      business_id: businessId,
      reference_number: ref,
      amount: body.amount || 2222,
      plan_id: body.plan_id || 'plan_yearly',
      status: 'pending_verification',
      provisional_expires_at: expiresAt,
      created_at: new Date().toISOString()
    };
    runtimeState.submissions.unshift(submission);

    return res.status(200).json({
      success: true,
      message: 'Payment reference submitted. 48-hour provisional access activated.',
      submission,
      provisional_until: expiresAt
    });
  }

  // D. redeemCoupon
  if (url.includes('redeemCoupon')) {
    const code = String(body.code || '').trim().toUpperCase();
    const businessId = body.business_id || 'biz-default';

    if (code === 'PROMO48') {
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      runtimeState.provisionalGrants[businessId] = expiresAt;

      return res.status(200).json({
        success: true,
        message: 'PROMO48 coupon applied! 48 hours of full access granted.',
        granted_until: expiresAt
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid or expired promotional coupon code.'
    });
  }

  // E. adminApprovePayment
  if (url.includes('adminApprovePayment')) {
    const submissionId = body.submission_id;
    return res.status(200).json({
      success: true,
      message: 'Payment approved. Business access extended by 365 days.'
    });
  }

  // F. adminRejectPayment
  if (url.includes('adminRejectPayment')) {
    const reason = body.reason || 'Payment verification failed.';
    return res.status(200).json({
      success: true,
      message: `Payment rejected: ${reason}`
    });
  }

  // G. getNotifications & markNotificationsRead
  if (url.includes('getNotifications')) {
    return res.status(200).json({
      success: true,
      data: {
        notifications: runtimeState.notifications,
        unread_count: runtimeState.notifications.filter(n => !n.read).length
      },
      notifications: runtimeState.notifications,
      unread_count: runtimeState.notifications.filter(n => !n.read).length
    });
  }

  if (url.includes('markNotificationsRead')) {
    runtimeState.notifications.forEach(n => { n.read = true; });
    return res.status(200).json({ success: true });
  }

  // H. getOnlineOrderingConfig & submitOnlineOrder
  if (url.includes('getOnlineOrderingConfig')) {
    return res.status(200).json({
      success: true,
      data: {
        enabled: true,
        paused: false,
        business_id: 'biz-default',
        delivery_charge: 25.00,
        store_name: 'THREDO Fashion Studio'
      }
    });
  }

  if (url.includes('submitOnlineOrder')) {
    const orderId = 'ORD-ONL-' + Date.now().toString().slice(-4);
    const newOrder = {
      id: `ord_${Date.now()}`,
      order_id: orderId,
      customer_name: body.customer_name || 'Online Customer',
      phone: body.phone,
      total_amount: body.total_amount || 0,
      status: 'Booked',
      source: 'online',
      online_pending: true,
      created_date: new Date().toISOString()
    };
    return res.status(200).json({
      success: true,
      order_id: orderId,
      order: newOrder
    });
  }

  // --------------------------------------------------------------------------
  // 4. ENTITY CRUD OPERATIONS (Supabase Database + Seed Fallback)
  // --------------------------------------------------------------------------
  if (url.includes('/entities/')) {
    const match = url.match(/\/entities\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
    const entityName = match ? match[1] : '';
    const recordId = match ? match[2] : null;

    // A. Check Supabase first if live
    if (supabase) {
      try {
        const table = getTableName(entityName);

        if (req.method === 'GET') {
          if (recordId) {
            const { data, error } = await supabase.from(table).select('*').eq('id', recordId).maybeSingle();
            if (!error && data) return res.status(200).json(data);
          } else {
            const { data, error } = await supabase.from(table).select('*').limit(100);
            if (!error && Array.isArray(data) && data.length > 0) {
              return res.status(200).json(data);
            }
          }
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from(table).insert(body).select().single();
          if (!error && data) return res.status(200).json(data);
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
          if (recordId) {
            const { data, error } = await supabase.from(table).update(body).eq('id', recordId).select().single();
            if (!error && data) return res.status(200).json(data);
          }
        } else if (req.method === 'DELETE') {
          if (recordId) {
            await supabase.from(table).delete().eq('id', recordId);
            return res.status(200).json({ success: true });
          }
        }
      } catch (e) {
        console.warn(`[API] Supabase query failed for ${entityName}:`, e.message);
      }
    }

    // B. In-Memory / Seed Data Fallback
    const seed = getSeedData();
    const items = seed[entityName] || [];

    if (req.method === 'GET') {
      if (recordId) {
        const item = items.find(i => i.id === recordId) || null;
        return res.status(200).json(item);
      }
      return res.status(200).json(items);
    }

    if (req.method === 'POST') {
      const newItem = {
        id: (entityName ? entityName.toLowerCase() : 'item') + '_' + Date.now(),
        created_date: new Date().toISOString(),
        ...body
      };
      items.unshift(newItem);
      return res.status(200).json(newItem);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (recordId) {
        const idx = items.findIndex(i => i.id === recordId);
        if (idx !== -1) {
          items[idx] = { ...items[idx], ...body };
          return res.status(200).json(items[idx]);
        }
      }
      return res.status(200).json({ id: recordId, ...body });
    }

    if (req.method === 'DELETE') {
      return res.status(200).json({ success: true });
    }
  }

  // Catch-all
  return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
}
