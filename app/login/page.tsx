"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/desk";
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(urlError);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (err) throw err;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
        });
        if (err) throw err;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setInfo(
            "Akun dibuat. Jika konfirmasi email aktif di Supabase, cek inbox dulu lalu login.",
          );
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="orb absolute -left-20 top-16 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.22),transparent_68%)]" />
      </div>

      <div className="animate-fade-up relative z-10 w-full max-w-md rounded-3xl border border-ink/10 bg-white/75 p-6 shadow-[0_20px_60px_-40px_rgba(11,31,42,0.45)] backdrop-blur sm:p-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-ink"
        >
          LUMEN
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          {mode === "login" ? "Masuk" : "Buat akun"}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Pustaka, riwayat chat, eval, dan metrik terpisah per akun.
        </p>

        <form className="mt-6 space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal/50"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 6)"
            className="w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal/50"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-mist transition hover:bg-teal disabled:opacity-50"
          >
            {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-ink-soft">
          <div className="h-px flex-1 bg-ink/10" />
          atau
          <div className="h-px flex-1 bg-ink/10" />
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void signInWithGoogle()}
          className="w-full rounded-full border border-ink/15 bg-white/80 px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-teal/40 hover:text-teal disabled:opacity-50"
        >
          Lanjutkan dengan Google
        </button>

        <p className="mt-5 text-center text-sm text-ink-soft">
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button
            type="button"
            className="font-semibold text-teal"
            onClick={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "login" ? "Daftar" : "Masuk"}
          </button>
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-xl bg-teal/10 px-3 py-2 text-xs text-teal">
            {info}
          </p>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-6 py-10 text-sm text-ink-soft">
          Memuat…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
