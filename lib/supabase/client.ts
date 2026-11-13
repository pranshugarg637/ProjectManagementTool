/**
 * Supabase client for the BROWSER (Client Components).
 * Used for: Realtime subscriptions and refetching board data.
 * Auth cookies are shared with the server automatically by @supabase/ssr.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

let browserClient: TypedSupabaseClient | undefined;

export function createClient(): TypedSupabaseClient {
  // One client per tab is enough (and keeps a single Realtime socket).
  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }
  return browserClient;
}
