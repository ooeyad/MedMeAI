import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Droplet, HeartPulse, Phone, Plus, Search, ShieldCheck, SlidersHorizontal, Users, X, } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { NewPatientModal } from "../components/NewPatientModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";
const DEFAULT_FILTERS = {
    q: "",
    kyc_status: "",
    gender: "",
    blood_type: "",
    age_min: "",
    age_max: "",
    allergen: "",
    has_chronic: false,
    has_insurance: false,
    insurance_company_id: null,
    sort: "newest",
};
const KYC_STATUSES = [
    { value: "pending", label: "Pending" },
    { value: "under_review", label: "Under review" },
    { value: "verified", label: "Verified" },
    { value: "rejected", label: "Rejected" },
];
const GENDERS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "name", label: "Name (A→Z)" },
    { value: "dob_desc", label: "Youngest first" },
    { value: "dob_asc", label: "Oldest first" },
];
function calcAge(dob) {
    if (!dob)
        return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime()))
        return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate()))
        age--;
    return age;
}
export function PatientsPage() {
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [qDebounced, setQDebounced] = useState("");
    const [allergenDebounced, setAllergenDebounced] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const canCreate = hasPermission("patients:write");
    useEffect(() => {
        const t = setTimeout(() => setQDebounced(filters.q), 250);
        return () => clearTimeout(t);
    }, [filters.q]);
    useEffect(() => {
        const t = setTimeout(() => setAllergenDebounced(filters.allergen), 400);
        return () => clearTimeout(t);
    }, [filters.allergen]);
    const insurersQ = useQuery({
        queryKey: ["insurance-companies"],
        queryFn: async () => (await api.get("/insurance/companies")).data,
    });
    const insurers = insurersQ.data?.data || [];
    const queryParams = useMemo(() => {
        const p = { page_size: 50 };
        if (qDebounced)
            p.q = qDebounced;
        if (filters.kyc_status)
            p.kyc_status = filters.kyc_status;
        if (filters.gender)
            p.gender = filters.gender;
        if (filters.blood_type)
            p.blood_type = filters.blood_type;
        if (filters.age_min)
            p.age_min = Number(filters.age_min);
        if (filters.age_max)
            p.age_max = Number(filters.age_max);
        if (allergenDebounced)
            p.allergen = allergenDebounced;
        if (filters.has_chronic)
            p.has_chronic = true;
        if (filters.has_insurance)
            p.has_insurance = true;
        if (filters.insurance_company_id)
            p.insurance_company_id = filters.insurance_company_id;
        if (filters.sort && filters.sort !== "newest")
            p.sort = filters.sort;
        return p;
    }, [qDebounced, allergenDebounced, filters]);
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["patients", queryParams],
        queryFn: async () => (await api.get("/patients/", { params: queryParams })).data,
        placeholderData: (prev) => prev,
    });
    const items = data?.data || [];
    const total = data?.meta?.total ?? items.length;
    const activeFilterCount = (filters.kyc_status ? 1 : 0) +
        (filters.gender ? 1 : 0) +
        (filters.blood_type ? 1 : 0) +
        (filters.age_min || filters.age_max ? 1 : 0) +
        (filters.allergen ? 1 : 0) +
        (filters.has_chronic ? 1 : 0) +
        (filters.has_insurance ? 1 : 0) +
        (filters.insurance_company_id ? 1 : 0);
    function reset() {
        setFilters(DEFAULT_FILTERS);
    }
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx(PageHeader, { title: "Patients", subtitle: `${total} ${total === 1 ? "patient" : "patients"} matching your filters`, icon: _jsx(Users, { size: 20 }), actions: _jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { value: filters.q, onChange: (e) => setFilters({ ...filters, q: e.target.value }), placeholder: "Name, phone, NID, email, code\u2026", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full sm:w-80" })] }), _jsxs("button", { onClick: () => setFiltersOpen((v) => !v), className: clsx("lg:hidden inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border border-ink-200", activeFilterCount > 0
                                ? "bg-brand-50 text-brand-700 border-brand-200"
                                : "bg-white text-ink-700"), children: [_jsx(SlidersHorizontal, { size: 14 }), " Filters", activeFilterCount > 0 && (_jsx("span", { className: "bg-brand-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold", children: activeFilterCount }))] }), canCreate && (_jsx(Button, { variant: "gradient", icon: _jsx(Plus, { size: 14 }), onClick: () => setShowCreate(true), children: "New patient" }))] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6", children: [_jsxs(FilterDrawer, { open: filtersOpen, onClose: () => setFiltersOpen(false), onReset: reset, activeFilterCount: activeFilterCount, children: [_jsx(FilterSection, { title: "Sort by", children: _jsx(SelectField, { value: filters.sort, onChange: (v) => setFilters({ ...filters, sort: v }), options: SORT_OPTIONS }) }), _jsx(FilterSection, { title: "KYC status", children: _jsx(ChipGroup, { options: KYC_STATUSES, value: filters.kyc_status, onChange: (v) => setFilters({ ...filters, kyc_status: v }) }) }), _jsx(FilterSection, { title: "Gender", children: _jsx(ChipGroup, { options: GENDERS, value: filters.gender, onChange: (v) => setFilters({ ...filters, gender: v }) }) }), _jsx(FilterSection, { title: "Blood type", children: _jsx("div", { className: "grid grid-cols-4 gap-1.5", children: BLOOD_TYPES.map((bt) => (_jsx("button", { onClick: () => setFilters({ ...filters, blood_type: filters.blood_type === bt ? "" : bt }), className: clsx("text-xs px-2 py-1 rounded-md transition font-mono", filters.blood_type === bt
                                            ? "bg-rose-600 text-white"
                                            : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: bt }, bt))) }) }), _jsx(FilterSection, { title: "Age range", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: 0, max: 150, value: filters.age_min, onChange: (e) => setFilters({ ...filters, age_min: e.target.value }), placeholder: "Min", className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsx("span", { className: "text-ink-400 text-xs", children: "to" }), _jsx("input", { type: "number", min: 0, max: 150, value: filters.age_max, onChange: (e) => setFilters({ ...filters, age_max: e.target.value }), placeholder: "Max", className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }) }), _jsx(FilterSection, { title: "Allergen", children: _jsx("input", { value: filters.allergen, onChange: (e) => setFilters({ ...filters, allergen: e.target.value }), placeholder: "e.g. penicillin", className: "w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }) }), _jsxs(FilterSection, { title: "Medical", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-ink-700 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: filters.has_chronic, onChange: (e) => setFilters({ ...filters, has_chronic: e.target.checked }), className: "size-4 rounded border-ink-300" }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(HeartPulse, { size: 12 }), " Has chronic condition(s)"] })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-ink-700 cursor-pointer mt-2", children: [_jsx("input", { type: "checkbox", checked: filters.has_insurance, onChange: (e) => setFilters({ ...filters, has_insurance: e.target.checked }), className: "size-4 rounded border-ink-300" }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(ShieldCheck, { size: 12 }), " Has insurance on file"] })] })] }), _jsx(FilterSection, { title: "Insurance company", children: _jsx(SelectField, { value: filters.insurance_company_id ? String(filters.insurance_company_id) : "", onChange: (v) => setFilters({ ...filters, insurance_company_id: v ? Number(v) : null }), options: [
                                        { value: "", label: "Any insurer" },
                                        ...insurers.map((c) => ({ value: String(c.id), label: c.name })),
                                    ] }) })] }), _jsxs("section", { children: [activeFilterCount > 0 && (_jsxs("div", { className: "mb-3 flex flex-wrap gap-1.5 items-center text-xs", children: [_jsx("span", { className: "text-ink-500 font-medium", children: "Filtering by:" }), filters.kyc_status && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, kyc_status: "" }), children: ["KYC: ", filters.kyc_status.replaceAll("_", " ")] })), filters.gender && (_jsx(Chip, { onClear: () => setFilters({ ...filters, gender: "" }), children: filters.gender })), filters.blood_type && (_jsx(Chip, { onClear: () => setFilters({ ...filters, blood_type: "" }), children: filters.blood_type })), (filters.age_min || filters.age_max) && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, age_min: "", age_max: "" }), children: ["Age ", filters.age_min || "0", "\u2013", filters.age_max || "∞"] })), filters.allergen && (_jsxs(Chip, { onClear: () => setFilters({ ...filters, allergen: "" }), children: ["Allergen: ", filters.allergen] })), filters.has_chronic && (_jsx(Chip, { onClear: () => setFilters({ ...filters, has_chronic: false }), children: "Chronic" })), filters.has_insurance && (_jsx(Chip, { onClear: () => setFilters({ ...filters, has_insurance: false }), children: "Has insurance" })), filters.insurance_company_id && (_jsx(Chip, { onClear: () => setFilters({ ...filters, insurance_company_id: null }), children: insurers.find((c) => c.id === filters.insurance_company_id)?.name || "Insurer" }))] })), _jsx(Card, { children: isLoading ? (_jsx(CardBody, { children: _jsx("div", { className: "space-y-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-12 bg-ink-100 rounded animate-pulse" }, i))) }) })) : items.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Users, { size: 20 }), title: "No patients match these filters", description: "Try removing a filter or broadening your search." })) : (_jsx("div", { className: clsx("overflow-x-auto", isFetching && "opacity-90"), children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "Patient" }), _jsx("th", { className: "py-3", children: "Code" }), _jsx("th", { className: "py-3", children: "Contact" }), _jsx("th", { className: "py-3", children: "Age / Sex" }), _jsx("th", { className: "py-3", children: "Medical" }), _jsx("th", { className: "py-3", children: "KYC" }), _jsx("th", { className: "px-5 py-3" })] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: items.map((p) => {
                                                    const age = calcAge(p.date_of_birth);
                                                    return (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { name: p.full_name_en, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-ink-800 truncate", children: p.full_name_en }), p.full_name_ar && (_jsx("div", { className: "text-xs text-ink-500 truncate", children: p.full_name_ar }))] })] }) }), _jsx("td", { className: "py-3 font-mono text-[11px] text-ink-500", children: p.code }), _jsxs("td", { className: "py-3 text-ink-700", children: [p.phone ? (_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Phone, { size: 11, className: "text-ink-400" }), p.phone] })) : "—", p.national_id && (_jsxs("div", { className: "text-[10px] text-ink-400 font-mono mt-0.5", children: ["NID ", p.national_id] }))] }), _jsxs("td", { className: "py-3 text-ink-700 whitespace-nowrap", children: [age !== null ? `${age}y` : "—", p.gender && (_jsxs("span", { className: "text-ink-400", children: [" \u00B7 ", p.gender[0].toUpperCase()] }))] }), _jsx("td", { className: "py-3", children: _jsxs("div", { className: "flex items-center gap-1.5 flex-wrap", children: [p.blood_type && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10px] font-medium", children: [_jsx(Droplet, { size: 9 }), " ", p.blood_type] })), p.allergies && p.allergies.length > 0 && (_jsxs("span", { title: p.allergies.join(", "), className: "inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium", children: [p.allergies.length, " allerg", p.allergies.length === 1 ? "y" : "ies"] })), p.chronic_diseases && p.chronic_diseases.length > 0 && (_jsxs("span", { title: p.chronic_diseases.join(", "), className: "inline-flex items-center gap-1 rounded-md bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium", children: [_jsx(HeartPulse, { size: 9 }), " ", p.chronic_diseases.length, " chronic"] })), (!p.blood_type && !p.allergies?.length && !p.chronic_diseases?.length) && (_jsx("span", { className: "text-ink-400 text-xs", children: "\u2014" }))] }) }), _jsx("td", { className: "py-3", children: _jsx(Badge, { tone: statusTone(p.kyc_status), dot: true, children: p.kyc_status.replaceAll("_", " ") }) }), _jsx("td", { className: "px-5 py-3 text-right", children: _jsxs(Link, { to: `/patients/${p.id}`, className: "inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium", children: ["Open ", _jsx(ArrowUpRight, { size: 12 })] }) })] }, p.id));
                                                }) })] }) })) })] })] }), _jsx(NewPatientModal, { open: showCreate, onClose: () => setShowCreate(false) })] }));
}
function FilterSection({ title, children, }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2", children: title }), children] }));
}
function SelectField({ value, onChange, options, }) {
    return (_jsxs("div", { className: "relative", children: [_jsx("select", { value: value, onChange: (e) => onChange(e.target.value), className: "w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }), _jsx(ChevronDown, { size: 14, className: "absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" })] }));
}
function ChipGroup({ options, value, onChange, }) {
    return (_jsx("div", { className: "flex flex-wrap gap-1.5", children: options.map((o) => (_jsx("button", { onClick: () => onChange(value === o.value ? "" : o.value), className: clsx("text-xs px-2.5 py-1 rounded-full transition", value === o.value
                ? "bg-brand-600 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"), children: o.label }, o.value))) }));
}
function Chip({ children, onClear }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5", children: [children, _jsx("button", { onClick: onClear, className: "hover:text-brand-900", children: _jsx(X, { size: 10 }) })] }));
}
