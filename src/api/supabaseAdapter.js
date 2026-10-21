import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

// Map Base44 entity names (PascalCase) to Supabase PostgreSQL table names (snake_case)
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

export function getTableName(entityName) {
  return ENTITY_TABLE_MAP[entityName] || entityName.toLowerCase() + 's';
}

/**
 * Supabase-backed Entity Operations
 */
export const supabaseAdapter = {
  isAvailable() {
    return isSupabaseConfigured && Boolean(supabase);
  },

  async filter(entityName, query = {}, sort = '-created_at', limit = 100) {
    if (!this.isAvailable()) return null;
    try {
      const table = getTableName(entityName);
      let q = supabase.from(table).select('*');

      // Apply equality filters
      if (query && typeof query === 'object') {
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined && value !== null) {
            q = q.eq(key, value);
          }
        }
      }

      // Apply sorting
      if (typeof sort === 'object' && sort !== null) {
        limit = sort.limit || limit;
        sort = sort.sort || '-created_at';
      }

      if (typeof sort === 'string' && sort) {
        const isDesc = sort.startsWith('-');
        const col = isDesc ? sort.substring(1) : sort;
        // Normalize created_date to created_at if needed
        const sortCol = col === 'created_date' ? 'created_at' : col;
        q = q.order(sortCol, { ascending: !isDesc });
      }

      if (limit) {
        q = q.limit(limit);
      }

      const { data, error } = await q;
      if (error) {
        console.warn(`[Supabase] filter on ${table} failed:`, error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[Supabase] filter exception on ${entityName}:`, err);
      return null;
    }
  },

  async get(entityName, id) {
    if (!this.isAvailable()) return null;
    try {
      const table = getTableName(entityName);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.warn(`[Supabase] get on ${table} failed:`, error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[Supabase] get exception on ${entityName}:`, err);
      return null;
    }
  },

  async create(entityName, payload) {
    if (!this.isAvailable()) return null;
    try {
      const table = getTableName(entityName);
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn(`[Supabase] create on ${table} failed:`, error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[Supabase] create exception on ${entityName}:`, err);
      return null;
    }
  },

  async update(entityName, id, payload) {
    if (!this.isAvailable()) return null;
    try {
      const table = getTableName(entityName);
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn(`[Supabase] update on ${table} failed:`, error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn(`[Supabase] update exception on ${entityName}:`, err);
      return null;
    }
  },

  async delete(entityName, id) {
    if (!this.isAvailable()) return null;
    try {
      const table = getTableName(entityName);
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        console.warn(`[Supabase] delete on ${table} failed:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[Supabase] delete exception on ${entityName}:`, err);
      return false;
    }
  }
};
