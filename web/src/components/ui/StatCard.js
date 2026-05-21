import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { TrendingDown, TrendingUp } from "lucide-react";
const ACCENTS = {
    brand: "from-brand-500 to-sky-500",
    violet: "from-violet-500 to-fuchsia-500",
    amber: "from-amber-500 to-rose-500",
    rose: "from-rose-500 to-pink-600",
    sky: "from-sky-500 to-indigo-600",
    emerald: "from-emerald-500 to-teal-600",
};
export function StatCard({ label, value, icon, accent = "brand", delta, hint }) {
    const positive = delta && delta.value >= 0;
    const goodDirection = delta?.positiveIsGood !== false ? positive : !positive;
    return (_jsxs("div", { className: "relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift", children: [_jsx("div", { className: clsx("absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl", ACCENTS[accent]) }), _jsxs("div", { className: "relative flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-ink-500 uppercase tracking-wider", children: label }), _jsx("div", { className: "mt-2 text-3xl font-semibold text-ink-900 tabular-nums", children: value }), hint && _jsx("div", { className: "mt-1 text-xs text-ink-500", children: hint }), delta && (_jsxs("div", { className: clsx("mt-2 inline-flex items-center gap-1 text-xs font-medium", goodDirection ? "text-emerald-600" : "text-rose-600"), children: [positive ? _jsx(TrendingUp, { size: 12 }) : _jsx(TrendingDown, { size: 12 }), Math.abs(delta.value), "% vs last period"] }))] }), _jsx("div", { className: clsx("size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft", ACCENTS[accent]), children: icon })] })] }));
}
