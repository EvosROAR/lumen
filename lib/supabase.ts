/** Re-export admin helpers for existing scripts. Prefer lib/supabase/* in app code. */
export {
  getSupabase,
  getSupabaseAdmin,
  hasSupabase,
  hasSupabaseAdmin,
  hasSupabasePublic,
} from "@/lib/supabase/admin";
