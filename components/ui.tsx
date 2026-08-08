import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-ink/10 bg-white/60 p-4 backdrop-blur sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "teal" | "warn" | "danger";
}) {
  const tones = {
    muted: "bg-ink/5 text-ink-soft",
    teal: "bg-teal/15 text-teal",
    warn: "bg-amber-500/15 text-amber-900",
    danger: "bg-red-500/10 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function ScoreBar({ score, max = 1 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / (max || 1)) * 100));
  return (
    <div
      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/8"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-teal transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "teal";
};

export function Btn({
  variant = "primary",
  className = "",
  ...props
}: BtnProps) {
  const variants = {
    primary:
      "bg-ink text-mist hover:bg-teal disabled:opacity-45",
    secondary:
      "border border-ink/15 bg-white/70 text-ink-soft hover:border-teal/40 hover:text-teal disabled:opacity-45",
    ghost: "text-ink-soft hover:text-teal disabled:opacity-45",
    teal: "border border-teal/30 bg-teal/10 text-teal hover:bg-teal hover:text-white disabled:opacity-45",
  };
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
