import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
export function Card({ children, className, hover }) {
    return (_jsx("div", { className: clsx("rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60", hover && "card-lift", className), children: children }));
}
export function CardHeader({ title, description, action, icon, }) {
    return (_jsxs("div", { className: "flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-start gap-3", children: [icon && (_jsx("div", { className: "size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center", children: icon })), _jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-ink-800 tracking-tight", children: title }), description && _jsx("p", { className: "text-xs text-ink-500 mt-0.5", children: description })] })] }), action && _jsx("div", { className: "shrink-0", children: action })] }));
}
export function CardBody({ children, className }) {
    return _jsx("div", { className: clsx("p-5", className), children: children });
}
