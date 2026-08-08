import { NextResponse } from "next/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  user: User;
  supabase: SupabaseClient;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { user, supabase };
}

export async function requireUser(): Promise<
  AuthContext | { error: NextResponse }
> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Silakan login dulu." },
        { status: 401 },
      ),
    };
  }
  return ctx;
}

export function isAuthError(
  value: AuthContext | { error: NextResponse },
): value is { error: NextResponse } {
  return "error" in value;
}
