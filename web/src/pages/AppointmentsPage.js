import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Calendar, CalendarDays, CheckCircle2, ChevronDown, Clock, Play, Plus, Search, SlidersHorizontal, Stethoscope, X, XCircle, } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
const DEFAULT_FILTERS = {
    q: "",
    statuses: [],
    doctor_id: null,
    branch_id: null,
    appointment_types: [],
    source_channel: "",
    date_from: "",
    date_to: "",
    sort: "starts_desc",
};
const STATUS_OPTIONS = [
    { value: "requested", label: "Requested" },
    { value: "pending_confirmation", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked-in" },
    { value: "in_consultation", label: "In consult" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No-show" },
    { value: "rejected", label: "Rejected" },
    { value: "rescheduled", label: "Rescheduled" },
];
const TYPE_OPTIONS = [
    { value: "new_consultation", label: "New consultation" },
    { value: "follow_up", label: "Follow-up" },
    { value: "lab_review", label: "Lab review" },
    { value: "procedure", label: "Procedure" },
    { value: "emergency", label: "Emergency" },
    { value: "telemedicine", label: "Telemedicine" },
    { value: "walk_in", label: "Walk-in" },
];
const SOURCE_OPTIONS = [
    { value: "", label: "Any source" },
    { value: "web", label: "Web" },
    { value: "mobile", label: "Mobile" },
    { value: "secretary", label: "Secretary" },
    { value: "ai", label: "AI assistant" },
    { value: "api", label: "API" },
];
const SORT_OPTIONS = [
    { value: "starts_desc", label: "Soonest end / latest first" },
    { value: "starts_asc", label: "Earliest first" },
    { value: "created_desc", label: "Recently booked" },
    { value: "created_asc", label: "Booked long ago" },
];
function isoDay(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function rangeFor(preset) {
    const t = new Date();
    const today = isoDay(t);
    const addDays = (n) => {
        const x = new Date(t);
        x.setDate(x.getDate() + n);
        return isoDay(x);
    };
    switch (preset) {
        case "today": return { date_from: today, date_to: today };
        case "tomorrow": return { date_from: addDays(1), date_to: addDays(1) };
        case "this_week": {
            const dow = (t.getDay() + 6) % 7; // Monday=0
            return { date_from: addDays(-dow), date_to: addDays(6 - dow) };
        }
        case "next_7": return { date_from: today, date_to: addDays(7) };
        case "next_30": return { date_from: today, date_to: addDays(30) };
        case "past_7": return { date_from: addDays(-7), date_to: today };
    }
}
export function AppointmentsPage() {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [qDebounced, setQDebounced] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const qc = useQueryClient();
    useEffect(() => {
        const t = setTimeout(() => setQDebounced(filters.q), 250);
        return () => clearTimeout(t);
    }, [filters.q]);
    // Lookups
    const doctorsQ = useQuery({
        queryKey: ["doctors-lite"],
        queryFn: async () => (await api.get("/doctors/", { params: { page_size: 200, sort: "name" } })).data,
    });
    const branchesQ = useQuery({
        queryKey: ["branches"],
        queryFn: async () => (await api.get("/branches/")).data,
    });
    const doctors = doctorsQ.data?.data || [];
    const branches = branchesQ.data?.data || [];
    // Build query params.
    // Dates are converted from the user's LOCAL day to a full UTC ISO string
    // before being sent. This ensures "Today" in Amman matches appointment rows
    // that were stored as UTC moments (without this, the off-by-three-hours
    // overlap between local and UTC days would skip some appointments).
    const queryParams = useMemo(() => {
        const p = { page_size: 60 };
        if (qDebounced)
            p.q = qDebounced;
        if (filters.statuses.length)
            p.statuses_csv = filters.statuses.join(",");
        if (filters.doctor_id)
            p.doctor_id = filters.doctor_id;
        if (filters.branch_id)
            p.branch_id = filters.branch_id;
        if (filters.appointment_types.length)
            p.appointment_types_csv = filters.appointment_types.join(",");
        if (filters.source_channel)
            p.source_channel = filters.source_channel;
        if (filters.date_from) {
            const d = new Date(`${filters.date_from}T00:00:00`); // local midnight
            p.date_from = d.toISOString(); // UTC ISO with Z
        }
        if (filters.date_to) {
            const d = new Date(`${filters.date_to}T23:59:59`); // local end of day
            p.date_to = d.toISOString();
        }
        if (filters.sort && filters.sort !== "starts_desc")
            p.sort = filters.sort;
        return p;
    }, [qDebounced, filters]);
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["appointments", queryParams],
        queryFn: async () => (await api.get("/appointments/", { params: queryParams })).data,
        placeholderData: (prev) => prev,
    });
    const items = data?.data || [];
    const total = data?.meta?.total ?? items.length;
    const transition = useMutation({
        mutationFn: async ({ id, action }) => api.post(`/appointments/${id}/${action}`, {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
    });
    const activeFilterCount = (filters.statuses.length ? 1 : 0) +
        (filters.doctor_id ? 1 : 0) +
        (filters.branch_id ? 1 : 0) +
        (filters.appointment_types.length ? 1 : 0) +
        (filters.source_channel ? 1 : 0) +
        (filters.date_from || filters.date_to ? 1 : 0);
    function toggleStatus(value) {
        setFilters((f) => f.statuses.includes(value)
            ? { ...f, statuses: f.statuses.filter((s) => s !== value) }
            : { ...f, statuses: [...f.statuses, value] });
    }
    function toggleType(value) {
        setFilters((f) => f.appointment_types.includes(value)
            ? { ...f, appointment_types: f.appointment_types.filter((t) => t !== value) }
            : { ...f, appointment_types: [...f.appointment_types, value] });
    }
    function applyPreset(preset) {
        const r = rangeFor(preset);
        setFilters((f) => ({ ...f, ...r }));
    }
    function reset() {
        setFilters(DEFAULT_FILTERS);
    }
    // Which preset (if any) corresponds to the current date_from/date_to so we
    // can highlight that button.
    const activePreset = useMemo(() => {
        if (!filters.date_from || !filters.date_to)
            return null;
        const presets = [
            "today", "tomorrow", "this_week", "next_7", "next_30", "past_7",
        ];
        for (const p of presets) {
            const r = rangeFor(p);
            if (r.date_from === filters.date_from && r.date_to === filters.date_to)
                return p;
        }
        return null;
    }, [filters.date_from, filters.date_to]);
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx(PageHeader, { title: "Appointments", subtitle: `${total} ${total === 1 ? "appointment" : "appointments"} matching your filters`, icon: _jsx(Calendar, { size: 20 }), actions: _jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { value: filters.q, onChange: (e) => setFilters({ ...filters, q: e.target.value }), placeholder: "Patient, code, phone, reason\u2026", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full sm:w-80" })] }), _jsxs("button", { onClick: () => setFiltersOpen((v) => !v), className: clsx("lg:hidden inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border border-ink-200", activeFilterCount > 0
                                ? "bg-brand-50 text-brand-700 border-brand-200"
                                : "bg-white text-ink-700"), children: [_jsx(SlidersHorizontal, { size: 14 }), " Filters", activeFilterCount > 0 && (_jsx("span", { className: "bg-brand-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold", children: activeFilterCount }))] }), _jsx(Link, { to: "/appointments/book", children: _jsx(Button, { variant: "gradient", icon: _jsx(Plus, { size: 14 }), children: "Book" }) })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6", children: [_jsxs(FilterDrawer, { open: filtersOpen, onClose: () => setFiltersOpen(false), onReset: reset, activeFilterCount: activeFilterCount, children: [_jsx(FilterSection, { title: "Sort by", children: _jsx(SelectField, { value: filters.sort, onChange: (v) => setFilters({ ...filters, sort: v }), options: SORT_OPTIONS }) }), _jsxs(FilterSection, { title: "Date", hint: "Quick picks", children: [_jsxs("div", { className: "grid grid-cols-2 gap-1.5 mb-2", children: [_jsx(PresetButton, { active: activePreset === "today", onClick: () => applyPreset("today"), children: "Today" }), _jsx(PresetButton, { active: activePreset === "tomorrow", onClick: () => applyPreset("tomorrow"), children: "Tomorrow" }), _jsx(PresetButton, { active: activePreset === "this_week", onClick: () => applyPreset("this_week"), children: "This week" }), _jsx(PresetButton, { active: activePreset === "next_7", onClick: () => applyPreset("next_7"), children: "Next 7 days" }), _jsx(PresetButton, { active: activePreset === "next_30", onClick: () => applyPreset("next_30"), children: "Next 30 days" }), _jsx(PresetButton, { active: activePreset === "past_7", onClick: () => applyPreset("past_7"), children: "Past 7 days" })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("input", { type: "date", value: filters.date_from, onChange: (e) => setFilters({ ...filters, date_from: e.target.value }), className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsx("input", { type: "date", value: filters.date_to, onChange: (e) => setFilters({ ...filters, date_to: e.target.value }), className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] })] }), _jsx(FilterSection, { title: "Status", hint: filters.statuses.length > 0 ? `${filters.statuses.length} selected` : undefined, children: _jsx("div", { className: "flex flex-wrap gap-1.5", children: STATUS_OPTIONS.map((o) => {
                                        const active = filters.statuses.includes(o.value);
                                        return (_jsx("button", { onClick: () => toggleStatus(o.value), className: clsx("text-xs px-2.5 py-1 rounded-full transition", active
                                                ? "bg-brand-600 text-white"
                                                : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: o.label }, o.value));
                                    }) }) }), _jsx(FilterSection, { title: "Doctor", children: _jsx(SelectField, { value: filters.doctor_id ? String(filters.doctor_id) : "", onChange: (v) => setFilters({ ...filters, doctor_id: v ? Number(v) : null }), options: [
                                        { value: "", label: "Any doctor" },
                                        ...doctors.map((d) => ({
                                            value: String(d.id),
                                            label: d.user?.full_name || `Doctor #${d.id}`,
                                        })),
                                    ] }) }), _jsx(FilterSection, { title: "Branch", children: _jsx(SelectField, { value: filters.branch_id ? String(filters.branch_id) : "", onChange: (v) => setFilters({ ...filters, branch_id: v ? Number(v) : null }), options: [
                                        { value: "", label: "Any branch" },
                                        ...branches.map((b) => ({ value: String(b.id), label: b.name })),
                                    ] }) }), _jsx(FilterSection, { title: "Type", hint: filters.appointment_types.length > 0 ? `${filters.appointment_types.length} selected` : undefined, children: _jsx("div", { className: "flex flex-wrap gap-1.5", children: TYPE_OPTIONS.map((o) => {
                                        const active = filters.appointment_types.includes(o.value);
                                        return (_jsx("button", { onClick: () => toggleType(o.value), className: clsx("text-xs px-2.5 py-1 rounded-full transition", active
                                                ? "bg-brand-600 text-white"
                                                : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: o.label }, o.value));
                                    }) }) }), _jsx(FilterSection, { title: "Booked via", children: _jsx(SelectField, { value: filters.source_channel, onChange: (v) => setFilters({ ...filters, source_channel: v }), options: SOURCE_OPTIONS }) })] }), _jsxs("section", { children: [activeFilterCount > 0 && (_jsxs("div", { className: "mb-3 flex flex-wrap gap-1.5 items-center text-xs", children: [_jsx("span", { className: "text-ink-500 font-medium", children: "Filtering by:" }), filters.statuses.map((s) => (_jsx(Chip, { onClear: () => toggleStatus(s), children: STATUS_OPTIONS.find((o) => o.value === s)?.label || s }, s))), filters.appointment_types.map((t) => (_jsx(Chip, { onClear: () => toggleType(t), children: TYPE_OPTIONS.find((o) => o.value === t)?.label || t }, t))), filters.doctor_id && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, doctor_id: null }), children: ["Dr. ", doctors.find((d) => d.id === filters.doctor_id)?.user?.full_name || "—"] })), filters.branch_id && (_jsx(Chip, { onClear: () => setFilters({ ...filters, branch_id: null }), children: branches.find((b) => b.id === filters.branch_id)?.name || "Branch" })), filters.source_channel && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, source_channel: "" }), children: ["via ", filters.source_channel] })), (filters.date_from || filters.date_to) && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, date_from: "", date_to: "" }), children: [_jsx(CalendarDays, { size: 10, className: "inline" }), " ", filters.date_from || "…", " \u2192 ", filters.date_to || "…"] }))] })), _jsx(Card, { children: isLoading ? (_jsx("div", { className: "p-5 space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-12 bg-ink-100 rounded animate-pulse" }, i))) })) : items.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Calendar, { size: 20 }), title: "No matching appointments", description: "Try clearing some filters or pick a wider date range." })) : (_jsx("div", { className: clsx("overflow-x-auto", isFetching && "opacity-90"), children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "Patient" }), _jsx("th", { className: "py-3", children: "Code" }), _jsx("th", { className: "py-3", children: "Doctor" }), _jsx("th", { className: "py-3", children: "When" }), _jsx("th", { className: "py-3", children: "Type" }), _jsx("th", { className: "py-3", children: "Status" }), _jsx("th", { className: "px-5 py-3" })] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: items.map((a) => (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-2.5", children: [_jsx(Avatar, { name: a.patient?.full_name_en, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-ink-800 truncate", children: a.patient?.full_name_en || a.patient?.code || "—" }), a.patient?.phone && (_jsx("div", { className: "text-xs text-ink-500", children: a.patient.phone }))] })] }) }), _jsx("td", { className: "py-3 font-mono text-[11px] text-ink-500", children: a.code }), _jsx("td", { className: "py-3 text-ink-700", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Stethoscope, { size: 12, className: "text-ink-400" }), a.doctor?.user?.full_name || "—"] }) }), _jsx("td", { className: "py-3 text-ink-600", children: _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(Clock, { size: 12, className: "text-ink-400" }), _jsx("span", { className: "font-mono text-xs", children: a.starts_at?.slice(0, 16).replace("T", " ") })] }) }), _jsxs("td", { className: "py-3 text-ink-600 text-xs", children: [a.appointment_type?.replaceAll("_", " ") || "—", a.source_channel && a.source_channel !== "web" && (_jsxs("div", { className: "text-[10px] text-ink-400 mt-0.5", children: ["via ", a.source_channel] }))] }), _jsx("td", { className: "py-3", children: _jsx(Badge, { tone: statusTone(a.status), dot: true, pulse: a.status === "in_consultation", children: a.status.replaceAll("_", " ") }) }), _jsx("td", { className: "px-5 py-3 text-right", children: _jsx(ActionMenu, { appt: a, onAction: (action) => transition.mutate({ id: a.id, action }) }) })] }, a.id))) })] }) })) })] })] })] }));
}
function FilterSection({ title, hint, children, }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: "text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center justify-between", children: [_jsx("span", { children: title }), hint && _jsx("span", { className: "text-ink-400 normal-case font-normal", children: hint })] }), children] }));
}
function SelectField({ value, onChange, options, }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("select", { value: value, onChange: (e) => onChange(e.target.value), className: "w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsx(ChevronDown, { size: 14, className: "absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" })] }));
}
function PresetButton({ children, active, onClick, }) {
    return (_jsx("button", { onClick: onClick, className: clsx("text-xs px-2 py-1.5 rounded-md transition", active
            ? "bg-brand-600 text-white shadow-soft"
            : "bg-ink-100 text-ink-700 hover:bg-brand-50 hover:text-brand-700"), children: children }));
}
function Chip({ children, onClear }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5", children: [children, _jsx("button", { onClick: onClear, className: "hover:text-brand-900", children: _jsx(X, { size: 10 }) })] }));
}
function ActionMenu({ appt, onAction }) {
    const actions = [];
    if (appt.status === "requested" || appt.status === "pending_confirmation") {
        actions.push({ label: "Confirm", action: "confirm", tone: "primary", icon: _jsx(CheckCircle2, { size: 12 }) });
    }
    if (appt.status === "confirmed") {
        actions.push({ label: "Check-in", action: "check-in", tone: "primary", icon: _jsx(CheckCircle2, { size: 12 }) });
    }
    if (appt.status === "checked_in") {
        actions.push({ label: "Start", action: "start", tone: "primary", icon: _jsx(Play, { size: 12 }) });
    }
    if (appt.status === "in_consultation") {
        actions.push({ label: "Complete", action: "complete", tone: "primary", icon: _jsx(CheckCircle2, { size: 12 }) });
    }
    if (["requested", "confirmed", "pending_confirmation", "checked_in"].includes(appt.status)) {
        actions.push({ label: "Cancel", action: "cancel", tone: "danger", icon: _jsx(XCircle, { size: 12 }) });
    }
    if (!actions.length)
        return _jsx("span", { className: "text-xs text-ink-400", children: "\u2014" });
    return (_jsx("div", { className: "flex items-center justify-end gap-1.5", children: actions.map((a) => (_jsxs("button", { onClick: () => onAction(a.action), className: `inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${a.tone === "danger"
                ? "text-rose-600 hover:bg-rose-50"
                : "text-brand-600 hover:bg-brand-50"}`, children: [a.icon, a.label] }, a.action))) }));
}
