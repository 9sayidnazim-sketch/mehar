import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Helper to execute Supabase query or return fallback if not configured
 */
export async function querySupabase(tableName, action = 'select', queryFn = null) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not configured') };
  }
  try {
    let query = supabase.from(tableName);
    if (queryFn) {
      query = queryFn(query);
    }
    const result = await query;
    return result;
  } catch (err) {
    return { data: null, error: err };
  }
}
