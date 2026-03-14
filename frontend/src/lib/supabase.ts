import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Guard against build-time or prerender calls without env vars.
  // All pages that call createClient() are "use client" components,
  // so this only fires at runtime in the browser where env vars exist.
  if (!url || !key) {
    console.warn("[Supabase] Missing env vars — client will not work until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.");
    // Return a client with empty strings — it won't make real API calls
    // but won't crash during static analysis or accidental import.
  }

  _client = createSupabaseClient(url, key, {
    auth: {
      flowType: "implicit",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
