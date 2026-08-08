"use client";

import { useEffect } from "react";
import { Btn } from "@/components/ui";

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "teal";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="animate-fade-up w-full max-w-md rounded-3xl border border-ink/10 bg-white/95 p-5 shadow-[0_24px_80px_-40px_rgba(11,31,42,0.55)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          className="font-[family-name:var(--font-display)] text-xl font-semibold text-ink"
        >
          {title}
        </h2>
        <p id="confirm-desc" className="mt-2 text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={tone === "danger" ? "primary" : "teal"}
            className={
              tone === "danger"
                ? "!bg-red-700 hover:!bg-red-800"
                : undefined
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Memproses…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}
