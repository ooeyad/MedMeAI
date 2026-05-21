import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowUpRight, CalendarCheck, CheckCircle2, Clock, HeartPulse, Play, Sparkles, Stethoscope, UserCheck, Users, } from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { useAuthStore } from "../store/auth";
const COLUMNS = [
    { key: "checked_in", title: "Checked in", statuses: ["checked_in"], tone: "warning", icon: _jsx(UserCheck, { size: 14 }) },
    { key: "in_consultation", title: "In consultation", statuses: ["in_consultation"], tone: "brand", icon: _jsx(Stethoscope, { size: 14 }) },
    { key: "scheduled", title: "Scheduled today", statuses: ["requested", "pending_confirmation", "confirmed"], tone: "info", icon: _jsx(Clock, { size: 14 }) },
    { key: "completed", title: "Completed today", statuses: ["completed"], tone: "success", icon: _jsx(CheckCircle2, { size: 14 }) },
];
export function DoctorDashboardPage() {
    const user = useAuthStore((s) => s.user);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = user?.full_name?.split(" ")[0] || "Doctor";
    const qc = useQueryClient();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    const endOfNext14 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14, 23, 59, 59).toISOString();
    const { data, isLoading } = useQuery({
        queryKey: ["doctor-today"],
        queryFn: async () => (await api.get("/appointments/", {
            params: { date_from: startOfDay, date_to: endOfDay, page_size: 100 },
        })).data,
    });
    const upcoming = useQuery({
        queryKey: ["doctor-upcoming"],
        queryFn: async () => (await api.get("/appointments/", {
            params: { date_from: startOfTomorrow, date_to: endOfNext14, page_size: 200 },
        })).data,
    });
    const items = data?.data || [];
    const buckets = COLUMNS.map((c) => ({
        ...c,
        items: items.filter((a) => c.statuses.includes(a.status)),
    }));
    const transition = useMutation({
        mutationFn: async ({ id, action }) => api.post(`/appointments/${id}/${action}`, {}),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["doctor-today"] });
            qc.invalidateQueries({ queryKey: ["doctor-upcoming"] });
        },
    });
    // Group upcoming by date (next 14 days, only active statuses)
    const upcomingItems = (upcoming.data?.data || []).filter((a) => ["requested", "pending_confirmation", "confirmed", "waiting_insurance_approval"].includes(a.status));
    const upcomingByDay = {};
    upcomingItems
        .slice()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .forEach((a) => {
        const day = a.starts_at.slice(0, 10);
        (upcomingByDay[day] ||= []).push(a);
    });
    // KPIs
    const total = items.length;
    const completed = buckets.find((b) => b.key === "completed").items.length;
    const inCons = buckets.find((b) => b.key === "in_consultation").items.length;
    const waiting = buckets.find((b) => b.key === "checked_in").items.length;
    return (_jsxs("div", { className: "space-y-6 max-w-7xl mx-auto", children: [_jsxs("div", { className: "relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-8 shadow-card", children: [_jsx("div", { className: "absolute -right-12 -top-12 size-72 rounded-full bg-white/10 blur-3xl pointer-events-none" }), _jsx("div", { className: "absolute right-10 bottom-0 opacity-10 pointer-events-none", children: _jsx(HeartPulse, { size: 160, strokeWidth: 1.4 }) }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "flex items-center gap-2 text-brand-100 text-xs uppercase tracking-wider font-semibold", children: [_jsx(Sparkles, { size: 14 }), " Today's clinic"] }), _jsxs("h1", { className: "mt-2 text-2xl md:text-3xl font-bold tracking-tight", children: [greeting, ", Dr. ", firstName] }), _jsx("p", { className: "mt-2 text-brand-50 text-sm max-w-xl", children: waiting > 0
                                    ? `${waiting} patient${waiting === 1 ? " is" : "s are"} waiting for you.`
                                    : "No one waiting right now. Your next checked-in patient will appear here." })] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsx(Kpi, { icon: _jsx(Users, { size: 18 }), label: "Total today", value: total, accent: "brand" }), _jsx(Kpi, { icon: _jsx(UserCheck, { size: 18 }), label: "Waiting", value: waiting, accent: "amber" }), _jsx(Kpi, { icon: _jsx(Stethoscope, { size: 18 }), label: "In consultation", value: inCons, accent: "violet" }), _jsx(Kpi, { icon: _jsx(CheckCircle2, { size: 18 }), label: "Completed", value: completed, accent: "emerald" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4", children: buckets.map((col) => (_jsxs(Card, { className: "flex flex-col", children: [_jsx(CardHeader, { title: col.title, description: `${col.items.length} patient${col.items.length === 1 ? "" : "s"}`, icon: col.icon }), _jsx(CardBody, { className: "flex-1 space-y-2 max-h-[60vh] overflow-auto scrollbar-thin", children: isLoading ? (Array.from({ length: 2 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-ink-100 animate-pulse" }, i)))) : col.items.length === 0 ? (_jsx("p", { className: "text-xs text-ink-500 py-4 text-center", children: "Nothing here." })) : (col.items.map((a) => (_jsx(QueueCard, { appt: a, onAction: (action) => transition.mutate({ id: a.id, action }) }, a.id)))) })] }, col.key))) }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Upcoming appointments", description: `${upcomingItems.length} appointment${upcomingItems.length === 1 ? "" : "s"} in the next 14 days`, icon: _jsx(CalendarCheck, { size: 16 }), action: _jsxs(Link, { to: "/appointments", className: "inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700", children: ["See full calendar ", _jsx(ArrowUpRight, { size: 12 })] }) }), _jsx(CardBody, { children: upcoming.isLoading ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-12 rounded-lg bg-ink-100 animate-pulse" }, i))) })) : Object.keys(upcomingByDay).length === 0 ? (_jsx("p", { className: "text-sm text-ink-500 py-4 text-center", children: "No upcoming appointments scheduled." })) : (_jsx("div", { className: "space-y-5", children: Object.entries(upcomingByDay).map(([day, appts]) => (_jsx(UpcomingDay, { day: day, appts: appts }, day))) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Quick actions", icon: _jsx(Activity, { size: 16 }) }), _jsx(CardBody, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 text-sm", children: [_jsx(QuickLink, { to: "/appointments", icon: _jsx(CalendarCheck, { size: 16 }), title: "All appointments" }), _jsx(QuickLink, { to: "/ai", icon: _jsx(Sparkles, { size: 16 }), title: "AI assistant" }), _jsx(QuickLink, { to: "/patients", icon: _jsx(Users, { size: 16 }), title: "Patient directory" })] }) })] })] }));
}
// ---------------------------------------------------------------------------
function QueueCard({ appt, onAction }) {
    const time = appt.starts_at?.slice(11, 16);
    const cta = nextAction(appt.status);
    return (_jsx("div", { className: "rounded-xl border border-ink-200 p-3 hover:border-brand-300 hover:bg-brand-50/30 transition", children: _jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx(Avatar, { name: appt.patient?.full_name_en, size: "sm" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("div", { className: "font-medium text-sm text-ink-800 truncate", children: appt.patient?.full_name_en || appt.patient?.code || "Patient" }), _jsx("span", { className: "text-[11px] font-mono text-ink-500", children: time })] }), _jsx("div", { className: "text-[11px] text-ink-500 truncate", children: appt.reason || "No reason given" }), _jsx("div", { className: "mt-2 flex items-center gap-1.5", children: _jsx(Badge, { tone: statusTone(appt.status), dot: true, pulse: appt.status === "in_consultation", children: appt.status.replaceAll("_", " ") }) }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5", children: [cta && (_jsxs("button", { onClick: () => onAction(cta.action), className: "inline-flex items-center gap-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium px-2 py-1 transition", children: [cta.icon, cta.label] })), (appt.status === "in_consultation" || appt.status === "checked_in" || appt.status === "completed") && (_jsxs(Link, { to: `/consult/${appt.id}`, className: "inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-medium px-2 py-1 transition", children: [_jsx(Stethoscope, { size: 12 }), " Open chart"] }))] })] })] }) }));
}
function nextAction(status) {
    if (status === "confirmed")
        return { action: "check-in", label: "Check in", icon: _jsx(UserCheck, { size: 12 }) };
    if (status === "checked_in")
        return { action: "start", label: "Start", icon: _jsx(Play, { size: 12 }) };
    if (status === "in_consultation")
        return { action: "complete", label: "Complete", icon: _jsx(CheckCircle2, { size: 12 }) };
    return null;
}
function UpcomingDay({ day, appts }) {
    const date = new Date(day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    const daysFromToday = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const label = isTomorrow
        ? "Tomorrow"
        : daysFromToday < 7
            ? date.toLocaleDateString("en-US", { weekday: "long" })
            : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-baseline gap-2 mb-2", children: [_jsx("span", { className: "text-sm font-semibold text-ink-800", children: label }), _jsx("span", { className: "text-xs text-ink-500 font-mono", children: day }), _jsxs("span", { className: "text-[11px] text-ink-400 ml-auto", children: [appts.length, " appointment", appts.length === 1 ? "" : "s"] })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2", children: appts.map((a) => (_jsx(UpcomingRow, { appt: a }, a.id))) })] }));
}
function UpcomingRow({ appt }) {
    const time = appt.starts_at?.slice(11, 16);
    return (_jsxs(Link, { to: `/consult/${appt.id}`, className: "flex items-center gap-2.5 rounded-xl border border-ink-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/30 transition group", children: [_jsx("div", { className: "size-9 rounded-lg bg-ink-50 text-ink-600 grid place-items-center font-mono text-xs font-semibold", children: time }), _jsx(Avatar, { name: appt.patient?.full_name_en, size: "sm" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-sm text-ink-800 truncate", children: appt.patient?.full_name_en || appt.patient?.code || "Patient" }), _jsx("div", { className: "text-[11px] text-ink-500 truncate", children: appt.reason || "No reason given" })] }), _jsx(Badge, { tone: statusTone(appt.status), dot: true, children: appt.status.replaceAll("_", " ") })] }));
}
function Kpi({ icon, label, value, accent }) {
    const accents = {
        brand: "from-brand-500 to-sky-500",
        amber: "from-amber-500 to-rose-500",
        violet: "from-violet-500 to-fuchsia-500",
        emerald: "from-emerald-500 to-teal-600",
    };
    return (_jsxs("div", { className: "relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift", children: [_jsx("div", { className: `absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl ${accents[accent]}` }), _jsxs("div", { className: "relative flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-medium text-ink-500 uppercase tracking-wider", children: label }), _jsx("div", { className: "mt-2 text-3xl font-semibold text-ink-900 tabular-nums", children: value })] }), _jsx("div", { className: `size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft ${accents[accent]}`, children: icon })] })] }));
}
function QuickLink({ to, icon, title }) {
    return (_jsxs(Link, { to: to, className: "flex items-center gap-3 rounded-xl border border-ink-200 p-3 hover:border-brand-300 hover:bg-brand-50/30 transition group", children: [_jsx("span", { className: "size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100", children: icon }), _jsx("span", { className: "font-medium text-ink-800", children: title }), _jsx(ArrowUpRight, { size: 14, className: "ml-auto text-ink-400 group-hover:text-brand-600" })] }));
}
