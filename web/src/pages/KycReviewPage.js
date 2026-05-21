import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
export function KycReviewPage() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["kyc-queue"],
        queryFn: async () => (await api.get("/kyc/queue")).data,
    });
    const decide = useMutation({
        mutationFn: async ({ id, decision }) => api.post(`/kyc/patients/${id}/verify`, { decision }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-queue"] }),
    });
    const items = data?.data || [];
    return (_jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsx(PageHeader, { title: "KYC Review", subtitle: `${items.length} patient${items.length === 1 ? "" : "s"} pending verification`, icon: _jsx(ClipboardCheck, { size: 20 }) }), _jsx(Card, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-2", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-14 bg-ink-100 rounded animate-pulse" }, i))) })) : items.length === 0 ? (_jsx(EmptyState, { icon: _jsx(CheckCircle2, { size: 20 }), title: "Queue is clear", description: "Every patient is verified. Nice work." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((p) => (_jsxs("li", { className: "p-4 flex items-center gap-4 hover:bg-ink-50/60 transition", children: [_jsx(Avatar, { name: p.full_name_en, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Link, { to: `/patients/${p.id}`, className: "font-medium text-ink-800 hover:text-brand-700", children: p.full_name_en }), _jsxs("div", { className: "text-xs text-ink-500 mt-0.5", children: [p.code, " \u00B7 ", p.phone || "no phone", " \u00B7 ", p.national_id || "no ID"] })] }), _jsx(Badge, { tone: statusTone(p.kyc_status), dot: true, children: p.kyc_status.replaceAll("_", " ") }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsxs("button", { onClick: () => decide.mutate({ id: p.id, decision: "verified" }), className: "inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 text-xs font-medium transition", children: [_jsx(CheckCircle2, { size: 12 }), " Verify"] }), _jsxs("button", { onClick: () => decide.mutate({ id: p.id, decision: "rejected" }), className: "inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 text-xs font-medium transition", children: [_jsx(XCircle, { size: 12 }), " Reject"] })] })] }, p.id))) })) })] }));
}
