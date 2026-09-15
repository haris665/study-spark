import { createClient } from "@supabase/supabase-js";
import { createLocalQueryBuilder, type LocalQueryBuilder } from "./local-adapter";

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

export const isSupabaseConfigured = Boolean(url && anonKey);

// Live Supabase is the source of truth whenever project credentials are present.
// The fallback keeps the app usable in an unconfigured local preview only.
const liveClient = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase: {
  from: (table: string) => LocalQueryBuilder | any;
  auth: any;
} = liveClient
  ? (liveClient as any)
  : {
      from: (table: string): LocalQueryBuilder => createLocalQueryBuilder(table),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    };
