import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, ChevronDown, GraduationCap, Languages, Pencil, Plus, Search, SlidersHorizontal, Stethoscope, Video, X, } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { MoveTenantDialog } from "../components/MoveTenantDialog";
import { NewDoctorModal } from "../components/NewDoctorModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission, useAuthStore } from "../store/auth";
const DEFAULT_FILTERS = {
    q: "",
    specialty_ids: [],
    branch_id: null,
    language: "",
    online_only: false,
    min_fee: "",
    max_fee: "",
    active_only: false,
    accepts_insurance_id: null,
    sort: "newest",
};
const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "name", label: "Name (A→Z)" },
    { value: "fee_asc", label: "Fee (low → high)" },
    { value: "fee_desc", label: "Fee (high → low)" },
    { value: "experience", label: "Experience" },
];
const COMMON_LANGUAGES = [
    { code: "en", label: "English" },
    { code: "ar", label: "Arabic" },
    { code: "fr", label: "French" },
];
export function DoctorsPage() {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [qDebounced, setQDebounced] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [editDoctor, setEditDoctor] = useState(null);
    const [moveDoctor, setMoveDoctor] = useState(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const isSuper = (useAuthStore.getState().user?.roles || []).includes("super_admin");
    const canCreate = hasPermission("doctors:write");
    const canEdit = hasPermission("doctors:write");
    // Debounce the text search so we don't pummel the API as the user types.
    useEffect(() => {
        const t = setTimeout(() => setQDebounced(filters.q), 250);
        return () => clearTimeout(t);
    }, [filters.q]);
    // Lookup data for filter controls
    const specialtiesQ = useQuery({
        queryKey: ["specialties"],
        queryFn: async () => (await api.get("/doctors/specialties")).data,
    });
    const branchesQ = useQuery({
        queryKey: ["branches"],
        queryFn: async () => (await api.get("/branches/")).data,
    });
    const insurersQ = useQuery({
        queryKey: ["insurance-companies"],
        queryFn: async () => (await api.get("/insurance/companies")).data,
    });
    const specialties = specialtiesQ.data?.data || [];
    const branches = branchesQ.data?.data || [];
    const insurers = insurersQ.data?.data || [];
    // Build server query params from filters.
    // NOTE: we send multi-value specialty_ids as a comma-separated string
    // (specialty_ids_csv) because axios's default serializer adds `[]` brackets
    // to array params, which Flask's `getlist` doesn't match.
    const queryParams = useMemo(() => {
        const p = { page_size: 60 };
        if (qDebounced)
            p.q = qDebounced;
        if (filters.specialty_ids.length)
            p.specialty_ids_csv = filters.specialty_ids.join(",");
        if (filters.branch_id)
            p.branch_id = filters.branch_id;
        if (filters.language)
            p.language = filters.language;
        if (filters.online_only)
            p.online_only = true;
        if (filters.min_fee)
            p.min_fee = Number(filters.min_fee);
        if (filters.max_fee)
            p.max_fee = Number(filters.max_fee);
        if (filters.active_only)
            p.active_only = true;
        if (filters.accepts_insurance_id)
            p.accepts_insurance_id = filters.accepts_insurance_id;
        if (filters.sort && filters.sort !== "newest")
            p.sort = filters.sort;
        return p;
    }, [qDebounced, filters]);
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["doctors", queryParams],
        queryFn: async () => (await api.get("/doctors/", { params: queryParams })).data,
        placeholderData: (prev) => prev,
    });
    const items = data?.data || [];
    const total = data?.meta?.total ?? items.length;
    const activeFilterCount = (filters.specialty_ids.length ? 1 : 0) +
        (filters.branch_id ? 1 : 0) +
        (filters.language ? 1 : 0) +
        (filters.online_only ? 1 : 0) +
        (filters.min_fee || filters.max_fee ? 1 : 0) +
        (filters.active_only ? 1 : 0) +
        (filters.accepts_insurance_id ? 1 : 0);
    function toggleSpecialty(id) {
        setFilters((f) => f.specialty_ids.includes(id)
            ? { ...f, specialty_ids: f.specialty_ids.filter((x) => x !== id) }
            : { ...f, specialty_ids: [...f.specialty_ids, id] });
    }
    function reset() {
        setFilters(DEFAULT_FILTERS);
    }
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx(PageHeader, { title: "Doctors", subtitle: `${total} ${total === 1 ? "doctor" : "doctors"} matching your filters`, icon: _jsx(Stethoscope, { size: 20 }), actions: _jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { value: filters.q, onChange: (e) => setFilters({ ...filters, q: e.target.value }), placeholder: "Search by name or license\u2026", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full sm:w-72" })] }), _jsxs("button", { onClick: () => setFiltersOpen((v) => !v), className: clsx("lg:hidden inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border border-ink-200", activeFilterCount > 0
                                ? "bg-brand-50 text-brand-700 border-brand-200"
                                : "bg-white text-ink-700"), children: [_jsx(SlidersHorizontal, { size: 14 }), " Filters", activeFilterCount > 0 && (_jsx("span", { className: "bg-brand-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold", children: activeFilterCount }))] }), canCreate && (_jsx(Button, { variant: "gradient", icon: _jsx(Plus, { size: 14 }), onClick: () => setShowCreate(true), children: "New doctor" }))] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6", children: [_jsxs(FilterDrawer, { open: filtersOpen, onClose: () => setFiltersOpen(false), onReset: reset, activeFilterCount: activeFilterCount, children: [_jsx(FilterSection, { title: "Sort by", children: _jsxs("div", { className: "relative", children: [_jsx("select", { value: filters.sort, onChange: (e) => setFilters({ ...filters, sort: e.target.value }), className: "w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: SORT_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsx(ChevronDown, { size: 14, className: "absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" })] }) }), _jsx(FilterSection, { title: "Specialties", hint: filters.specialty_ids.length > 0 ? `${filters.specialty_ids.length} selected` : undefined, children: specialtiesQ.isLoading ? (_jsx("div", { className: "text-xs text-ink-400", children: "Loading\u2026" })) : (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [specialties.map((s) => {
                                            const active = filters.specialty_ids.includes(s.id);
                                            return (_jsx("button", { onClick: () => toggleSpecialty(s.id), className: clsx("text-xs px-2.5 py-1 rounded-full transition", active
                                                    ? "bg-brand-600 text-white"
                                                    : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: s.name }, s.id));
                                        }), specialties.length === 0 && (_jsx("div", { className: "text-xs text-ink-500", children: "No specialties yet" }))] })) }), _jsx(FilterSection, { title: "Branch", children: _jsxs("div", { className: "relative", children: [_jsxs("select", { value: filters.branch_id ?? "", onChange: (e) => setFilters({ ...filters, branch_id: e.target.value ? Number(e.target.value) : null }), className: "w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: [_jsx("option", { value: "", children: "All branches" }), branches.map((b) => (_jsx("option", { value: b.id, children: b.name }, b.id)))] }), _jsx(ChevronDown, { size: 14, className: "absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" })] }) }), _jsx(FilterSection, { title: "Speaks language", children: _jsx("div", { className: "flex flex-wrap gap-1.5", children: COMMON_LANGUAGES.map((l) => (_jsx("button", { onClick: () => setFilters({ ...filters, language: filters.language === l.code ? "" : l.code }), className: clsx("text-xs px-2.5 py-1 rounded-full transition", filters.language === l.code
                                            ? "bg-brand-600 text-white"
                                            : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: l.label }, l.code))) }) }), _jsxs(FilterSection, { title: "Availability", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-ink-700 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: filters.online_only, onChange: (e) => setFilters({ ...filters, online_only: e.target.checked }), className: "size-4 rounded border-ink-300" }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Video, { size: 12 }), " Telemedicine only"] })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-ink-700 cursor-pointer mt-2", children: [_jsx("input", { type: "checkbox", checked: filters.active_only, onChange: (e) => setFilters({ ...filters, active_only: e.target.checked }), className: "size-4 rounded border-ink-300" }), "Active only"] })] }), _jsx(FilterSection, { title: "Consultation fee", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: 0, value: filters.min_fee, onChange: (e) => setFilters({ ...filters, min_fee: e.target.value }), placeholder: "Min", className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsx("span", { className: "text-ink-400 text-xs", children: "to" }), _jsx("input", { type: "number", min: 0, value: filters.max_fee, onChange: (e) => setFilters({ ...filters, max_fee: e.target.value }), placeholder: "Max", className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }) }), _jsx(FilterSection, { title: "Accepts insurance", children: _jsxs("div", { className: "relative", children: [_jsxs("select", { value: filters.accepts_insurance_id ?? "", onChange: (e) => setFilters({
                                                ...filters,
                                                accepts_insurance_id: e.target.value ? Number(e.target.value) : null,
                                            }), className: "w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: [_jsx("option", { value: "", children: "Any insurer" }), insurers.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }), _jsx(ChevronDown, { size: 14, className: "absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" })] }) })] }), _jsxs("section", { children: [activeFilterCount > 0 && (_jsxs("div", { className: "mb-3 flex flex-wrap gap-1.5 items-center text-xs", children: [_jsx("span", { className: "text-ink-500 font-medium", children: "Filtering by:" }), filters.specialty_ids.map((sid) => {
                                        const s = specialties.find((x) => x.id === sid);
                                        if (!s)
                                            return null;
                                        return (_jsx(Chip, { onClear: () => toggleSpecialty(sid), children: s.name }, sid));
                                    }), filters.branch_id && (_jsx(Chip, { onClear: () => setFilters({ ...filters, branch_id: null }), children: branches.find((b) => b.id === filters.branch_id)?.name || "Branch" })), filters.language && (_jsx(Chip, { onClear: () => setFilters({ ...filters, language: "" }), children: COMMON_LANGUAGES.find((l) => l.code === filters.language)?.label || filters.language })), filters.online_only && (_jsx(Chip, { onClear: () => setFilters({ ...filters, online_only: false }), children: "Telemedicine" })), filters.active_only && (_jsx(Chip, { onClear: () => setFilters({ ...filters, active_only: false }), children: "Active only" })), (filters.min_fee || filters.max_fee) && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, min_fee: "", max_fee: "" }), children: [filters.min_fee || "0", " \u2013 ", filters.max_fee || "∞"] })), filters.accepts_insurance_id && (_jsx(Chip, { onClear: () => setFilters({ ...filters, accepts_insurance_id: null }), children: insurers.find((c) => c.id === filters.accepts_insurance_id)?.name || "Insurance" }))] })), isLoading ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Card, { children: _jsx(CardBody, { children: _jsx("div", { className: "h-20 bg-ink-100 rounded animate-pulse" }) }) }, i))) })) : items.length === 0 ? (_jsx(Card, { children: _jsx(EmptyState, { icon: _jsx(Stethoscope, { size: 20 }), title: "No doctors match these filters", description: "Try removing a filter or broadening your search." }) })) : (_jsx("div", { className: clsx("grid grid-cols-1 md:grid-cols-2 gap-4", isFetching && "opacity-90"), children: items.map((d) => (_jsx(Card, { hover: true, children: _jsx(CardBody, { children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Avatar, { name: d.user?.full_name, size: "lg", ring: true }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-semibold text-ink-800 truncate", children: d.user?.full_name }), _jsx("div", { className: "text-xs text-ink-500 truncate", children: (d.specialties || []).map((s) => s.name).join(" · ") || "—" })] }), _jsx(Badge, { tone: d.is_active ? "success" : "neutral", dot: true, pulse: d.is_active, children: d.is_active ? "active" : "inactive" })] }), _jsxs("div", { className: "mt-3 grid grid-cols-2 gap-2 text-xs", children: [_jsx(Pill, { icon: _jsx(GraduationCap, { size: 11 }), label: "License", value: d.license_number }), _jsx(Pill, { icon: _jsx(Languages, { size: 11 }), label: "Languages", value: (d.languages || []).join(", ") || "—" }), d.consultation_fee != null && (_jsx(Pill, { icon: _jsx("span", { className: "text-[10px]", children: "$" }), label: "Fee", value: `${Number(d.consultation_fee).toFixed(0)}` })), d.online_appointments && (_jsxs("div", { className: "flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-violet-700 text-[11px] font-medium", children: [_jsx(Video, { size: 11 }), " Telemedicine"] }))] }), d.bio && _jsx("p", { className: "mt-3 text-xs text-ink-500 line-clamp-2", children: d.bio }), _jsxs("div", { className: "mt-3 flex items-center gap-1.5 flex-wrap", children: [canEdit && (_jsxs("button", { onClick: () => setEditDoctor(d), className: "inline-flex items-center gap-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium px-2 py-1 transition", children: [_jsx(Pencil, { size: 11 }), " Edit"] })), isSuper && (_jsxs("button", { onClick: () => setMoveDoctor(d), className: "inline-flex items-center gap-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium px-2 py-1 transition", children: [_jsx(ArrowRightLeft, { size: 11 }), " Move tenant"] }))] })] })] }) }) }, d.id))) }))] })] }), _jsx(NewDoctorModal, { open: showCreate, onClose: () => setShowCreate(false) }), _jsx(NewDoctorModal, { open: !!editDoctor, onClose: () => setEditDoctor(null), existing: editDoctor }), _jsx(MoveTenantDialog, { open: !!moveDoctor, onClose: () => setMoveDoctor(null), entityKind: "doctor", entityId: moveDoctor?.id || 0, entityName: moveDoctor?.user?.full_name || "doctor", currentTenantId: moveDoctor?.tenant_id })] }));
}
function FilterSection({ title, hint, children, }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: "text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center justify-between", children: [_jsx("span", { children: title }), hint && _jsx("span", { className: "text-ink-400 normal-case font-normal", children: hint })] }), children] }));
}
function Chip({ children, onClear }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5", children: [children, _jsx("button", { onClick: onClear, className: "hover:text-brand-900", children: _jsx(X, { size: 10 }) })] }));
}
function Pill({ icon, label, value }) {
    return (_jsxs("div", { className: "flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-ink-600 truncate", children: [_jsx("span", { className: "text-ink-400", children: icon }), _jsxs("span", { className: "text-ink-500", children: [label, ":"] }), _jsx("span", { className: "font-medium text-ink-800 truncate", children: value })] }));
}
