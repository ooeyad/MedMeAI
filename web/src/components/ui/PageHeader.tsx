import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="size-11 rounded-xl bg-brand-gradient text-white grid place-items-center shadow-soft shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-ink-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
