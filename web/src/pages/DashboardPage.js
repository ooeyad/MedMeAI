import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, ClipboardCheck, Clock, FileText, HeartPulse, ShieldCheck, Sparkles, Stethoscope, TrendingUp, UserPlus, } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { hasPermission, useAuthStore } from "../store/auth";
export function DashboardPage() {
    const user = useAuthStore((s) => s.user);
    const isPatient = (user?.roles || []).includes("patient");
    if (isPatient)
        return _jsx(PatientDashboard, {});
    return _jsx(ClinicDashboard, {});
}
function ClinicDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ["overview"],
        queryFn: async () => (await api.get("/reports/overview")).data,
    });
    const user = useAuthStore((s) => s.user);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = user?.full_name?.split(" ")[0] || "there";
    return (_jsxs("div", { className: "space-y-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-8 shadow-card", children: [_jsx("div", { className: "absolute -right-12 -top-12 size-72 rounded-full bg-white/10 blur-3xl pointer-events-none" }), _jsx("div", { className: "absolute right-10 bottom-0 opacity-10 pointer-events-none", children: _jsx(HeartPulse, { size: 160, strokeWidth: 1.4 }) }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2 text-brand-100 text-xs uppercase tracking-wider font-semibold", children: [_jsx(Sparkles, { size: 14 }), " Today at a glance"] }), _jsxs("h1", { className: "mt-2 text-2xl md:text-3xl font-bold tracking-tight", children: [greeting, ", ", firstName] }), _jsx("p", { className: "mt-2 text-brand-50 text-sm max-w-xl", children: "Here's what's happening across your clinic right now. Use the AI assistant for instant answers, or jump straight to today's schedule." }), _jsxs("div", { className: "mt-5 flex flex-wrap gap-2", children: [_jsxs(Link, { to: "/appointments/book", className: "inline-flex items-center gap-2 bg-white text-brand-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition shadow-soft", children: [_jsx(CalendarDays, { size: 14 }), " Book appointment"] }), _jsxs(Link, { to: "/ai", className: "inline-flex items-center gap-2 bg-white/15 text-white ring-1 ring-white/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/25 transition backdrop-blur", children: [_jsx(Sparkles, { size: 14 }), " Ask AI assistant"] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(StatCard, { label: "Total appointments", value: isLoading ? "—" : data?.total_appointments ?? 0, icon: _jsx(CalendarDays, { size: 18 }), accent: "brand", hint: "all-time" }), _jsx(StatCard, { label: "Last 30 days", value: isLoading ? "—" : data?.appointments_last_30_days ?? 0, icon: _jsx(TrendingUp, { size: 18 }), accent: "sky", hint: "appointments booked" }), _jsx(StatCard, { label: "No-show rate", value: isLoading ? "—" : `${((data?.no_show_rate || 0) * 100).toFixed(1)}%`, icon: _jsx(AlertTriangle, { size: 18 }), accent: "amber" }), _jsx(StatCard, { label: "Insurance pending", value: isLoading ? "—" : data?.insurance_pending_approvals ?? 0, icon: _jsx(ShieldCheck, { size: 18 }), accent: "violet", hint: "awaiting approval" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { title: "Appointments by status", description: "Live distribution across the lifecycle", icon: _jsx(CalendarDays, { size: 16 }), action: _jsxs(Link, { to: "/appointments", className: "inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700", children: ["Open all ", _jsx(ArrowUpRight, { size: 12 })] }) }), _jsx(CardBody, { children: isLoading ? (_jsx(Skeleton, {})) : Object.keys(data?.appointments_by_status || {}).length === 0 ? (_jsx("p", { className: "py-6 text-sm text-ink-500", children: "No appointment activity yet." })) : (_jsx(StatusBars, { items: data.appointments_by_status })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "KYC funnel", description: `${data?.new_patients_last_30_days ?? 0} new patients in 30 days`, icon: _jsx(ClipboardCheck, { size: 16 }) }), _jsx(CardBody, { children: isLoading ? (_jsx(Skeleton, {})) : (_jsxs("ul", { className: "space-y-2.5 text-sm", children: [Object.entries(data?.kyc_breakdown || {}).map(([k, v]) => (_jsxs("li", { className: "flex items-center justify-between", children: [_jsx(Badge, { tone: statusTone(k), dot: true, children: k.replaceAll("_", " ") }), _jsx("span", { className: "font-semibold text-ink-800 tabular-nums", children: v })] }, k))), !Object.keys(data?.kyc_breakdown || {}).length && (_jsx("li", { className: "text-ink-500 py-2", children: "No verifications yet." }))] })) })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [hasPermission("patients:write") && (_jsx(QuickAction, { to: "/patients", icon: _jsx(UserPlus, { size: 18 }), title: "New patient", description: "Register a patient and start KYC." })), hasPermission("doctors:read") && (_jsx(QuickAction, { to: "/doctors", icon: _jsx(Stethoscope, { size: 18 }), title: "Doctor directory", description: "Schedules, specialties, networks." })), hasPermission("kyc:verify") && (_jsx(QuickAction, { to: "/kyc", icon: _jsx(ClipboardCheck, { size: 18 }), title: "KYC review", description: "Verify identity and insurance docs." }))] })] }));
}
// ---------------------------------------------------------------------------
// Patient-focused dashboard
// ---------------------------------------------------------------------------
function PatientDashboard() {
    const user = useAuthStore((s) => s.user);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = user?.full_name?.split(" ")[0] || "there";
    const apptsQuery = useQuery({
        queryKey: ["my-appointments"],
        queryFn: async () => (await api.get("/appointments/", { params: { page_size: 10 } })).data,
    });
    const insuranceQuery = useQuery({
        queryKey: ["my-insurance", user?.patient_id],
        queryFn: async () => (await api.get(`/insurance/patients/${user?.patient_id}`)).data,
        enabled: !!user?.patient_id,
    });
    const kycQuery = useQuery({
        queryKey: ["my-kyc", user?.patient_id],
        queryFn: async () => (await api.get(`/kyc/patients/${user?.patient_id}`)).data,
        enabled: !!user?.patient_id,
    });
    const rawAppointments = apptsQuery.data?.data || [];
    const insurances = insuranceQuery.data?.data || [];
    const kycStatus = kycQuery.data?.status || "pending";
    // Only consider future appointments as "upcoming" — a confirmed slot from
    // yesterday is over, not next.
    const nowIso = new Date().toISOString();
    const upcoming = rawAppointments
        .filter((a) => ["requested", "pending_confirmation", "confirmed", "checked_in", "waiting_insurance_approval"].includes(a.status)
        && a.starts_at >= nowIso)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const next = upcoming[0];
    // Display order: upcoming first (soonest at top), then past (most recent at top).
    const past = rawAppointments
        .filter((a) => !upcoming.includes(a))
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const appointments = [...upcoming, ...past];
    return (_jsxs("div", { className: "space-y-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-8 shadow-card", children: [_jsx("div", { className: "absolute -right-12 -top-12 size-72 rounded-full bg-white/10 blur-3xl pointer-events-none" }), _jsx("div", { className: "absolute right-10 bottom-0 opacity-10 pointer-events-none", children: _jsx(HeartPulse, { size: 160, strokeWidth: 1.4 }) }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2 text-brand-100 text-xs uppercase tracking-wider font-semibold", children: [_jsx(Sparkles, { size: 14 }), " Your health, organised"] }), _jsxs("h1", { className: "mt-2 text-2xl md:text-3xl font-bold tracking-tight", children: [greeting, ", ", firstName] }), _jsx("p", { className: "mt-2 text-brand-50 text-sm max-w-xl", children: "Manage appointments, upload your KYC documents, and check insurance \u2014 or ask the AI assistant for anything." }), _jsxs("div", { className: "mt-5 flex flex-wrap gap-2", children: [_jsxs(Link, { to: "/appointments/book", className: "inline-flex items-center gap-2 bg-white text-brand-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition shadow-soft", children: [_jsx(CalendarDays, { size: 14 }), " Book appointment"] }), _jsxs(Link, { to: "/ai", className: "inline-flex items-center gap-2 bg-white/15 text-white ring-1 ring-white/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/25 transition backdrop-blur", children: [_jsx(Sparkles, { size: 14 }), " Ask AI assistant"] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(PatientStatCard, { icon: _jsx(Clock, { size: 18 }), accent: "brand", label: "Next appointment", value: next ? next.starts_at.slice(0, 16).replace("T", " ") : "—", hint: next ? `${next.doctor?.user?.full_name || ""} · ${next.status.replaceAll("_", " ")}` : "Nothing scheduled" }), _jsx(PatientStatCard, { icon: _jsx(ClipboardCheck, { size: 18 }), accent: kycStatus === "verified" ? "emerald" : "amber", label: "KYC status", value: kycStatus.replaceAll("_", " "), hint: kycStatus === "verified" ? "All set" : "Upload documents to verify" }), _jsx(PatientStatCard, { icon: _jsx(ShieldCheck, { size: 18 }), accent: insurances.length ? "violet" : "rose", label: "Insurance plans", value: String(insurances.length), hint: insurances.length ? insurances[0]?.insurance_company_id ? `Primary on file` : "Linked" : "Add a plan" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { title: "My appointments", description: "Upcoming first, then most recent", icon: _jsx(CalendarDays, { size: 16 }), action: _jsxs(Link, { to: "/appointments", className: "inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700", children: ["See all ", _jsx(ArrowUpRight, { size: 12 })] }) }), _jsx(CardBody, { children: apptsQuery.isLoading ? (_jsx(Skeleton, {})) : appointments.length === 0 ? (_jsxs("div", { className: "text-sm text-ink-500 py-4", children: ["You don't have any appointments yet.", " ", _jsx(Link, { to: "/appointments/book", className: "text-brand-600 font-medium", children: "Book your first" }), "."] })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: appointments.slice(0, 6).map((a) => (_jsxs("li", { className: "py-3 flex items-center gap-3", children: [_jsx(Avatar, { name: a.doctor?.user?.full_name, size: "sm" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-ink-800 truncate", children: a.doctor?.user?.full_name || "Doctor" }), _jsxs("div", { className: "text-xs text-ink-500", children: [a.starts_at?.slice(0, 16).replace("T", " "), " \u00B7 ", a.code] })] }), _jsx(Badge, { tone: statusTone(a.status), dot: true, pulse: a.status === "in_consultation", children: a.status.replaceAll("_", " ") })] }, a.id))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Quick actions", icon: _jsx(Sparkles, { size: 16 }) }), _jsx(CardBody, { children: _jsxs("div", { className: "space-y-2", children: [_jsx(PatientAction, { to: "/appointments/book", icon: _jsx(CalendarDays, { size: 16 }), label: "Book appointment" }), _jsx(PatientAction, { to: "/ai", icon: _jsx(Sparkles, { size: 16 }), label: "Ask AI assistant" }), _jsx(PatientAction, { to: "/profile", icon: _jsx(FileText, { size: 16 }), label: "My documents (KYC)" }), _jsx(PatientAction, { to: "/appointments", icon: _jsx(CheckCircle2, { size: 16 }), label: "My appointments" })] }) })] })] })] }));
}
function PatientStatCard({ icon, label, value, hint, accent = "brand", }) {
    const accents = {
        brand: "from-brand-500 to-sky-500",
        emerald: "from-emerald-500 to-teal-600",
        amber: "from-amber-500 to-rose-500",
        rose: "from-rose-500 to-pink-600",
        violet: "from-violet-500 to-fuchsia-500",
    };
    return (_jsxs("div", { className: "relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift", children: [_jsx("div", { className: `absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl ${accents[accent]}` }), _jsxs("div", { className: "relative flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-ink-500 uppercase tracking-wider", children: label }), _jsx("div", { className: "mt-2 text-lg font-semibold text-ink-900 capitalize", children: value }), hint && _jsx("div", { className: "mt-1 text-xs text-ink-500", children: hint })] }), _jsx("div", { className: `size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft ${accents[accent]}`, children: icon })] })] }));
}
function PatientAction({ to, icon, label }) {
    return (_jsxs(Link, { to: to, className: "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition group", children: [_jsx("span", { className: "size-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100", children: icon }), label, _jsx(ArrowUpRight, { size: 12, className: "ml-auto text-ink-400 group-hover:text-brand-600" })] }));
}
function StatusBars({ items }) {
    const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    const toneBg = {
        neutral: "bg-ink-400",
        brand: "bg-brand-500",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        amber: "bg-amber-500",
        danger: "bg-rose-500",
        info: "bg-sky-500",
        violet: "bg-violet-500",
    };
    return (_jsx("ul", { className: "space-y-3", children: entries.map(([k, v]) => {
            const tone = statusTone(k);
            return (_jsxs("li", { children: [_jsxs("div", { className: "flex justify-between text-xs text-ink-600 mb-1", children: [_jsx("span", { className: "capitalize", children: k.replaceAll("_", " ") }), _jsx("span", { className: "font-semibold tabular-nums text-ink-800", children: v })] }), _jsx("div", { className: "h-1.5 rounded-full bg-ink-100 overflow-hidden", children: _jsx("div", { className: `h-full rounded-full ${toneBg[tone] || "bg-ink-400"}`, style: { width: `${(v / max) * 100}%`, transition: "width 600ms ease" } }) })] }, k));
        }) }));
}
function QuickAction({ to, icon, title, description, }) {
    return (_jsx(Link, { to: to, className: "group rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift block", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100 transition", children: icon }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-semibold text-ink-800 text-sm", children: title }), _jsx("div", { className: "text-xs text-ink-500 mt-0.5", children: description })] }), _jsx(ArrowUpRight, { size: 14, className: "text-ink-400 group-hover:text-brand-600 transition" })] }) }));
}
function Skeleton() {
    return (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-3 bg-ink-100 rounded animate-pulse" }), _jsx("div", { className: "h-3 bg-ink-100 rounded animate-pulse w-5/6" }), _jsx("div", { className: "h-3 bg-ink-100 rounded animate-pulse w-3/4" })] }));
}
