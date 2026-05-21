import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileText, Receipt, Search } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
const STATUS_TONES = {
    draft: "neutral",
    open: "info",
    paid: "success",
    partial: "warning",
    void: "neutral",
    refunded: "danger",
};
export function InvoicesPage() {
    const [status, setStatus] = useState("");
    const [q, setQ] = useState("");
    const { data, isLoading } = useQuery({
        queryKey: ["invoices", status],
        queryFn: async () => (await api.get("/billing/invoices", {
            params: { status: status || undefined, page_size: 100 },
        })).data,
    });
    const items = data?.data || [];
    const filtered = q
        ? items.filter((inv) => (inv.code || "").toLowerCase().includes(q.toLowerCase()))
        : items;
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx(PageHeader, { title: "Invoices", subtitle: `${data?.meta?.total ?? 0} invoices in your tenant`, icon: _jsx(Receipt, { size: 20 }), actions: _jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Invoice code", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-56" })] }), _jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: [_jsx("option", { value: "", children: "All statuses" }), Object.keys(STATUS_TONES).map((k) => (_jsx("option", { value: k, children: k }, k)))] })] }) }), _jsx(Card, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-10 bg-ink-100 rounded animate-pulse" }, i))) })) : filtered.length === 0 ? (_jsx(EmptyState, { icon: _jsx(FileText, { size: 20 }), title: "No invoices yet", description: "Complete an appointment to auto-generate the first invoice." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "Code" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Issued" }), _jsx("th", { className: "text-right", children: "Total" }), _jsx("th", { className: "text-right", children: "Paid" }), _jsx("th", { className: "text-right", children: "Balance" }), _jsx("th", { className: "text-right", children: "Insurance" }), _jsx("th", { className: "px-5 py-3" })] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: filtered.map((inv) => (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-2 font-mono text-xs", children: inv.code }), _jsx("td", { className: "py-2", children: _jsx(Badge, { tone: STATUS_TONES[inv.status] || "neutral", dot: true, children: inv.status }) }), _jsx("td", { className: "py-2 font-mono text-xs text-ink-500", children: inv.issued_at?.slice(0, 16).replace("T", " ") }), _jsxs("td", { className: "py-2 text-right font-medium text-ink-800 tabular-nums", children: [Number(inv.total).toFixed(2), " ", inv.currency] }), _jsx("td", { className: "py-2 text-right text-emerald-700 tabular-nums", children: Number(inv.paid_total).toFixed(2) }), _jsx("td", { className: "py-2 text-right text-rose-700 tabular-nums", children: Number(inv.balance).toFixed(2) }), _jsx("td", { className: "py-2 text-right text-ink-600 tabular-nums", children: Number(inv.insurance_share).toFixed(2) }), _jsx("td", { className: "px-5 py-2 text-right", children: _jsxs(Link, { to: `/invoices/${inv.id}`, className: "text-brand-600 hover:text-brand-700 text-xs font-medium inline-flex items-center gap-1", children: ["Open ", _jsx(ArrowUpRight, { size: 12 })] }) })] }, inv.id))) })] }) })) })] }));
}
