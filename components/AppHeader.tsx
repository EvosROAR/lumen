"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/desk", label: "Desk" },
  { href: "/experiments", label: "Eksperimen" },
  { href: "/eval", label: "Eval" },
  { href: "/metrics", label: "Metrik" },
];

export function AppHeader({
  title,
  email: emailProp,
  trailing,
}: {
  title?: string;
  email?: string | null;
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(emailProp ?? null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (emailProp) {
      setEmail(emailProp);
      return;
    }
    void (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        setEmail(data.user?.email ?? null);
      } catch {
        setEmail(null);
      }
    })();
  }, [emailProp]);

  async function signOut() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setLogoutOpen(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="shrink-0 font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-ink"
          >
            LUMEN
          </Link>
          {title && (
            <span className="hidden truncate text-xs text-ink-soft md:inline">
              {title}
            </span>
          )}
        </div>

        <nav className="flex max-w-[55%] items-center gap-1 overflow-x-auto text-xs sm:max-w-none sm:gap-1">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-2.5 py-1.5 transition ${
                  active
                    ? "bg-teal/15 font-semibold text-teal"
                    : "text-ink-soft hover:bg-ink/5 hover:text-teal"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 text-xs">
          <div className="hidden items-center gap-2 lg:flex">{trailing}</div>
          {email && (
            <span
              className="hidden max-w-[140px] truncate rounded-full bg-ink/5 px-2.5 py-1 text-ink-soft xl:inline"
              title={email}
            >
              {email}
            </span>
          )}
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="rounded-full border border-ink/15 px-2.5 py-1 font-medium text-ink-soft transition hover:border-teal/40 hover:text-teal"
          >
            Keluar
          </button>
        </div>
      </div>
      {trailing && (
        <div className="flex gap-2 overflow-x-auto border-t border-ink/5 px-4 py-2 lg:hidden sm:px-6">
          {trailing}
        </div>
      )}
    </header>

    <ConfirmModal
      open={logoutOpen}
      title="Keluar dari Lumen?"
      description={
        email
          ? `Sesi ${email} akan diakhiri. Kamu perlu login lagi untuk mengakses desk dan data akunmu.`
          : "Sesi akan diakhiri. Kamu perlu login lagi untuk mengakses desk dan data akunmu."
      }
      confirmLabel="Ya, keluar"
      cancelLabel="Batal"
      tone="teal"
      busy={loggingOut}
      onCancel={() => {
        if (!loggingOut) setLogoutOpen(false);
      }}
      onConfirm={() => void signOut()}
    />
    </>
  );
}
