import clsx from "clsx";
import { ReactNode } from "react";

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60",
        hover && "card-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-ink-100">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-ink-800 tracking-tight">{title}</h2>
          {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}
