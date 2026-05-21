import clsx from "clsx";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gradient";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-soft",
  secondary: "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50 shadow-soft",
  ghost: "text-ink-600 hover:bg-ink-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-soft",
  gradient: "bg-brand-gradient text-white hover:opacity-95 shadow-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
