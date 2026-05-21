import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function EmptyState({ icon, title, description, action, }) {
    return (_jsxs("div", { className: "text-center py-12 px-6", children: [_jsx("div", { className: "mx-auto size-14 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center mb-4", children: icon }), _jsx("h3", { className: "text-sm font-semibold text-ink-800", children: title }), description && _jsx("p", { className: "mt-1 text-sm text-ink-500 max-w-sm mx-auto", children: description }), action && _jsx("div", { className: "mt-4", children: action })] }));
}
export function SkeletonRow({ cols = 4 }) {
    return (_jsx("div", { className: "grid gap-3 py-3", style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }, children: Array.from({ length: cols }).map((_, i) => (_jsx("div", { className: "h-3 rounded bg-ink-100 animate-pulse" }, i))) }));
}
