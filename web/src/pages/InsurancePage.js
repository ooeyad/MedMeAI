import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
export function InsurancePage() {
    const { data, isLoading } = useQuery({
        queryKey: ["insurance-companies"],
        queryFn: async () => (await api.get("/insurance/companies")).data,
    });
    const items = data?.data || [];
    return (_jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsx(PageHeader, { title: "Insurance", subtitle: "Companies accepted across your clinic network", icon: _jsx(ShieldCheck, { size: 20 }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: [isLoading && Array.from({ length: 3 }).map((_, i) => (_jsx(Card, { children: _jsx(CardBody, { children: _jsx("div", { className: "h-12 bg-ink-100 rounded animate-pulse" }) }) }, i))), !isLoading && items.length === 0 && (_jsx("div", { className: "col-span-full", children: _jsx(Card, { children: _jsx(EmptyState, { icon: _jsx(ShieldCheck, { size: 20 }), title: "No insurance companies yet", description: "Once the seed runs you'll see network coverage here." }) }) })), items.map((c) => (_jsx(Card, { hover: true, children: _jsx(CardBody, { children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Avatar, { name: c.name, size: "lg" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("h3", { className: "font-semibold text-ink-800 leading-tight", children: c.name }), _jsx(Badge, { tone: c.active ? "success" : "neutral", dot: true, pulse: c.active, children: c.active ? "active" : "inactive" })] }), c.name_ar && _jsx("div", { className: "text-xs text-ink-500 mt-0.5", children: c.name_ar }), _jsxs("div", { className: "mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-ink-500 bg-ink-50 px-2 py-1 rounded", children: [_jsx(ShieldCheck, { size: 11 }), " ", c.code] })] })] }) }) }, c.id)))] }), _jsxs(Card, { className: "mt-6", children: [_jsx(CardHeader, { title: "How insurance works in MedMeAI", description: "Per-patient plans are linked to one of these companies", icon: _jsx(ShieldCheck, { size: 16 }) }), _jsx(CardBody, { children: _jsxs("ul", { className: "text-sm text-ink-600 space-y-2", children: [_jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "text-brand-500", children: "\u25CF" }), " Patients upload their card; OCR extracts policy + member numbers automatically."] }), _jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "text-brand-500", children: "\u25CF" }), " Booking checks the doctor's accepted networks and flags appointments that need pre-approval."] }), _jsxs("li", { className: "flex gap-2", children: [_jsx("span", { className: "text-brand-500", children: "\u25CF" }), " Officers approve from the queue; status flows back to the patient via in-app + push notifications."] })] }) })] })] }));
}
