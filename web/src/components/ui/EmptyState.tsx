import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto size-14 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-500 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="grid gap-3 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-ink-100 animate-pulse" />
      ))}
    </div>
  );
}
