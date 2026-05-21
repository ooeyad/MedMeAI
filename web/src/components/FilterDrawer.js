import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from "react";
import { CheckCircle2, Filter, RotateCcw, X } from "lucide-react";
import clsx from "clsx";
/**
 * Responsive filter container.
 *
 * - On `lg` (desktop) screens: renders as an inline sticky sidebar, always visible.
 * - On smaller screens: renders as a bottom-sheet overlay with backdrop + Done
 *   button. The page content stays visible underneath when closed.
 *
 * The `open` state is irrelevant on lg — the panel is always there. On mobile,
 * it slides up from the bottom when `open` is true.
 */
export function FilterDrawer({ open, onClose, onReset, activeFilterCount, children, }) {
    // Lock body scroll while the mobile sheet is open
    useEffect(() => {
        if (!open)
            return;
        const isLg = window.matchMedia("(min-width: 1024px)").matches;
        if (isLg)
            return; // desktop: nothing to lock
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);
    return (_jsxs(_Fragment, { children: [_jsx("aside", { className: "hidden lg:block", children: _jsxs("div", { className: "rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 overflow-hidden lg:sticky lg:top-20", children: [_jsxs("div", { className: "px-4 py-3 border-b border-ink-100 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-semibold text-ink-800", children: [_jsx(Filter, { size: 14 }), " Filters", activeFilterCount > 0 && (_jsx("span", { className: "bg-brand-100 text-brand-700 text-[10px] rounded-full px-1.5 py-0.5 font-semibold", children: activeFilterCount }))] }), activeFilterCount > 0 && onReset && (_jsxs("button", { onClick: onReset, className: "text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1", children: [_jsx(RotateCcw, { size: 11 }), " Clear"] }))] }), _jsx("div", { className: "p-4 space-y-5 max-h-[calc(100vh-12rem)] overflow-y-auto scrollbar-thin", children: children })] }) }), open && (_jsxs("div", { className: "fixed inset-0 z-40 lg:hidden", children: [_jsx("button", { type: "button", "aria-label": "Close filters", onClick: onClose, className: "absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-fade-in" }), _jsxs("div", { className: clsx("absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-lift", "flex flex-col max-h-[90vh] animate-slide-up"), style: { paddingBottom: "env(safe-area-inset-bottom, 0px)" }, children: [_jsx("div", { className: "pt-2 flex justify-center", children: _jsx("div", { className: "w-10 h-1.5 rounded-full bg-ink-200" }) }), _jsxs("div", { className: "px-4 py-3 border-b border-ink-100 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-base font-semibold text-ink-800", children: [_jsx(Filter, { size: 16 }), " Filters", activeFilterCount > 0 && (_jsx("span", { className: "bg-brand-100 text-brand-700 text-[10px] rounded-full px-1.5 py-0.5 font-semibold", children: activeFilterCount }))] }), _jsxs("div", { className: "flex items-center gap-3", children: [activeFilterCount > 0 && onReset && (_jsxs("button", { onClick: onReset, className: "text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1", children: [_jsx(RotateCcw, { size: 11 }), " Clear"] })), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 20 }) })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin", children: children }), _jsx("div", { className: "border-t border-ink-100 p-3", children: _jsxs("button", { onClick: onClose, className: "w-full inline-flex items-center justify-center gap-1.5 bg-brand-gradient text-white text-sm font-medium rounded-lg px-4 py-3 shadow-soft", children: [_jsx(CheckCircle2, { size: 16 }), " Show results"] }) })] })] }))] }));
}
