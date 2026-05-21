import { ReactNode } from "react";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: "brand" | "violet" | "amber" | "rose" | "sky" | "emerald";
  delta?: { value: number; positiveIsGood?: boolean };
  hint?: string;
}

const ACCENTS = {
  brand: "from-brand-500 to-sky-500",
  violet: "from-violet-500 to-fuchsia-500",
  amber: "from-amber-500 to-rose-500",
  rose: "from-rose-500 to-pink-600",
  sky: "from-sky-500 to-indigo-600",
  emerald: "from-emerald-500 to-teal-600",
} as const;

export function StatCard({ label, value, icon, accent = "brand", delta, hint }: Props) {
  const positive = delta && delta.value >= 0;
  const goodDirection = delta?.positiveIsGood !== false ? positive : !positive;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift">
      {/* corner accent */}
      <div
        className={clsx(
          "absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl",
          ACCENTS[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink-900 tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
          {delta && (
            <div
              className={clsx(
                "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                goodDirection ? "text-emerald-600" : "text-rose-600",
              )}
            >
              {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(delta.value)}% vs last period
            </div>
          )}
        </div>
        <div
          className={clsx(
            "size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft",
            ACCENTS[accent],
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
