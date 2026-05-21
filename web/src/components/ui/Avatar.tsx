import clsx from "clsx";

const GRADIENTS = [
  "from-brand-400 to-sky-500",
  "from-violet-400 to-fuchsia-500",
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-rose-400 to-pink-600",
  "from-cyan-400 to-blue-600",
];

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  src?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
};

export function Avatar({ name, size = "md", ring, src }: Props) {
  const gradient = GRADIENTS[hashCode(name || "?") % GRADIENTS.length];
  return (
    <div
      className={clsx(
        "relative shrink-0 grid place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-soft",
        gradient,
        SIZES[size],
        ring && "ring-2 ring-white",
      )}
    >
      {src ? (
        <img src={src} alt={name} className="rounded-full size-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}
