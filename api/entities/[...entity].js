import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';
  const match = url.match(/\/entities\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
  const entityName = match ? match[1] : '';
  const recordId = match ? match[2] : null;

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  // 1. Try Supabase if live
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
      console.warn(`[API Entities] Supabase query failed for ${entityName}:`, e.message);
    }
  }

  // 2. In-Memory / Seed Data Fallback
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

  return res.status(200).json(items);
}
