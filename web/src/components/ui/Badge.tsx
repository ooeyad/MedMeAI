import clsx from "clsx";
import { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet" | "amber";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-ink-400",
  brand: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  amber: "bg-amber-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  violet: "bg-violet-500",
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span className={clsx("status-dot", DOT_TONES[tone], pulse && "pulse")} />
      )}
      {children}
    </span>
  );
}

// Map appointment status to tone
export function statusTone(status: string): Tone {
  const map: Record<string, Tone> = {
    requested: "info",
    pending_confirmation: "warning",
    confirmed: "success",
    checked_in: "violet",
    in_consultation: "brand",
    completed: "neutral",
    cancelled: "danger",
    no_show: "warning",
    waiting_insurance_approval: "amber",
    rescheduled: "info",
    rejected: "danger",
    verified: "success",
    pending: "warning",
    requires_review: "info",
    active: "success",
    inactive: "neutral",
  };
  return map[status] || "neutral";
}
