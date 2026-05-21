import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { FileSearch, Globe } from "lucide-react";
import { api } from "../api/client";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
export function AuditPage() {
    const { data, isLoading } = useQuery({
        queryKey: ["audit"],
        queryFn: async () => (await api.get("/audit/", { params: { page_size: 50 } })).data,
    });
    const items = data?.data || [];
    return (_jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsx(PageHeader, { title: "Audit Log", subtitle: "Every mutating action across the platform", icon: _jsx(FileSearch, { size: 20 }) }), _jsx(Card, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-10 bg-ink-100 rounded animate-pulse" }, i))) })) : items.length === 0 ? (_jsx(EmptyState, { icon: _jsx(FileSearch, { size: 20 }), title: "No audit entries yet", description: "Actions like booking, KYC verification, and AI tool calls land here." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((a) => (_jsxs("li", { className: "p-4 flex items-start gap-3 hover:bg-ink-50/60 transition", children: [_jsx("div", { className: "size-9 rounded-lg bg-ink-50 text-ink-500 grid place-items-center shrink-0", children: _jsx(FileSearch, { size: 14 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-mono text-[11px] text-ink-500", children: a.at?.slice(0, 19).replace("T", " ") }), a.source_channel && (_jsxs("span", { className: "inline-flex items-center gap-1 text-[10px] text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded", children: [_jsx(Globe, { size: 9 }), " ", a.source_channel] }))] }), _jsx("div", { className: "mt-0.5 text-sm font-medium text-ink-800", children: a.action }), _jsxs("div", { className: "text-xs text-ink-500 mt-0.5", children: ["user #", a.user_id, " \u00B7 ", a.entity_type, " #", a.entity_id] })] })] }, a.id))) })) })] }));
}
