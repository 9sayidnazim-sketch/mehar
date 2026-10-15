import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const serverUrl = import.meta.env.VITE_BASE44_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const appId = import.meta.env.VITE_BASE44_APP_ID || appParams.appId || 'thredo-app';

// Official Base44 Client instance
export const base44 = createClient({
  serverUrl,
  appId,
  requiresAuth: false
});

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

  const countryDigits = String(countryCode || '971').replace(/[^0-9]/g, '');
  let raw = String(phoneInput).replace(/[\s+\-()_.]/g, '');

  if (raw.startsWith('00')) {
    raw = raw.replace(/^00+/, '');
  } else if (raw.startsWith('0')) {
    raw = raw.replace(/^0+/, '');
  }

  let formatted = raw;
  if (!formatted.startsWith(countryDigits)) {
    formatted = countryDigits + formatted;
  }

  formatted = formatted.replace(/[^0-9]/g, '');
  const isValid = formatted.length >= 8 && formatted.length <= 15;

  return {
    formatted,
    isValid,
    error: isValid ? '' : 'Please enter a valid WhatsApp number'
  };
}

// Proxy wrapper around Base44 SDK that provides safe fallbacks
// and ensures consistent API for legacy components
const entitiesProxy = new Proxy(base44.entities, {
  get(target, prop) {
    if (typeof prop === 'string') {
      const originalHandler = target[prop];
      if (originalHandler) {
        return originalHandler;
      }
      return {
        async list(sort = '-created_date', limit = 100) {
          try {
            return await base44.entities[prop].list(sort, limit);
          } catch (e) {
            console.warn(`[Base44 Entities] list error on ${prop}:`, e);
            return [];
          }
        },
        async filter(query = {}, sort = '-created_date', limit = 100) {
          try {
            return await base44.entities[prop].filter(query, sort, limit);
          } catch (e) {
            console.warn(`[Base44 Entities] filter error on ${prop}:`, e);
            const empty = [];
            empty.items = [];
            return empty;
          }
        },
        async get(id) {
          try {
            return await base44.entities[prop].get(id);
          } catch (e) {
            return null;
          }
        },
        async create(data) {
          return await base44.entities[prop].create(data);
        },
        async update(id, data) {
          return await base44.entities[prop].update(id, data);
        },
        async delete(id) {
          return await base44.entities[prop].delete(id);
        }
      };
    }
    return undefined;
  }
});

export const db = {
  auth: base44.auth,
  entities: entitiesProxy,
  asServiceRole: base44.asServiceRole,
  functions: {
    async invoke(name, payload = {}) {
      try {
        const res = await base44.functions.invoke(name, payload);
        return res;
      } catch (err) {
        // Direct fetch fallback if SDK function router is on local proxy
        try {
          const fetchRes = await fetch(`/api/functions/${name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(base44.auth.hasToken() ? { Authorization: `Bearer ${localStorage.getItem('base44_access_token') || localStorage.getItem('token')}` } : {})
            },
            body: JSON.stringify(payload)
          });
          const data = await fetchRes.json();
          if (!fetchRes.ok) throw new Error(data.error || 'Function invocation failed');
          return { data, ...data };
        } catch (fetchErr) {
          throw err;
        }
      }
    }
  },
  integrations: base44.integrations
};

// Global assignment for inline scripts if any
if (typeof window !== 'undefined') {
  window.__B44_DB__ = db;
}
if (typeof globalThis !== 'undefined') {
  globalThis.__B44_DB__ = db;
}

export default db;