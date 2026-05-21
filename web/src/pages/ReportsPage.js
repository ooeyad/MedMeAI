import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardCheck, Stethoscope } from "lucide-react";
import { api } from "../api/client";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
export function ReportsPage() {
    const utilization = useQuery({
        queryKey: ["doctor-utilization"],
        queryFn: async () => (await api.get("/reports/doctor-utilization")).data,
    });
    const kyc = useQuery({
        queryKey: ["kyc-funnel"],
        queryFn: async () => (await api.get("/reports/kyc-funnel")).data,
    });
    const util = utilization.data?.data || [];
    const maxAppts = Math.max(...util.map((d) => d.appointments || 0), 1);
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx(PageHeader, { title: "Reports", subtitle: "Aggregates and trends across your clinic", icon: _jsx(Activity, { size: 20 }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { title: "Doctor utilization", description: "Last 30 days \u00B7 appointments by doctor", icon: _jsx(Stethoscope, { size: 16 }) }), _jsx(CardBody, { children: utilization.isLoading ? (_jsx("div", { className: "h-32 bg-ink-100 rounded animate-pulse" })) : util.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500", children: "No utilization data yet." })) : (_jsx("ul", { className: "space-y-3", children: util.map((d) => (_jsxs("li", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-ink-800 font-medium", children: d.doctor_name }), _jsxs("span", { className: "text-ink-500 tabular-nums", children: [d.appointments, " appt \u00B7 ", Math.round((d.total_seconds || 0) / 3600 * 10) / 10, "h"] })] }), _jsx("div", { className: "h-2 rounded-full bg-ink-100 overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-brand-400 to-sky-500", style: { width: `${(d.appointments / maxAppts) * 100}%`, transition: "width 600ms ease" } }) })] }, d.doctor_id))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "KYC funnel", description: "Verification states across all patients", icon: _jsx(ClipboardCheck, { size: 16 }) }), _jsx(CardBody, { children: kyc.isLoading ? (_jsx("div", { className: "h-32 bg-ink-100 rounded animate-pulse" })) : (_jsxs("ul", { className: "space-y-2.5 text-sm", children: [Object.entries(kyc.data || {}).map(([k, v]) => (_jsxs("li", { className: "flex items-center justify-between", children: [_jsx(Badge, { tone: statusTone(k), dot: true, children: k.replaceAll("_", " ") }), _jsx("span", { className: "font-semibold text-ink-800 tabular-nums", children: v })] }, k))), !Object.keys(kyc.data || {}).length && (_jsx("li", { className: "text-ink-500 py-2", children: "No verifications yet." }))] })) })] })] })] }));
}
