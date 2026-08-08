import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

/** True when public Supabase URL + anon key are configured (auth + RLS path). */
export function hasSupabasePublic() {
  return Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim()) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** True when service-role admin client can be created (scripts only). */
export function hasSupabaseAdmin() {
  return Boolean(
    (process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** @deprecated use hasSupabasePublic / hasSupabaseAdmin */
export function hasSupabase() {
  return hasSupabasePublic() || hasSupabaseAdmin();
}

let cached: SupabaseClient | null = null;

/** Service-role client for seed/admin scripts. Bypass RLS — do not use in request handlers. */
export function getSupabaseAdmin(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Supabase admin belum dikonfigurasi. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    });
  }
  return cached;
}

/** Back-compat alias used by older scripts. */
export function getSupabase() {
  return getSupabaseAdmin();
}
