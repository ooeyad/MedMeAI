import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Pencil, Plus, ShieldCheck, Trash2, Upload, X, XCircle } from "lucide-react";
import { api } from "../api/client";
import { BulkImportModal } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";
const COMPANY_IMPORT_COLUMNS = [
    { key: "name", header: "Name", required: true, aliases: ["insurer", "company"] },
    { key: "code", header: "Code", hint: "Auto-generated if blank" },
    { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name"] },
    { key: "logo_url", header: "Logo URL", aliases: ["logo"] },
    { key: "active", header: "Active", aliases: ["enabled", "status"], hint: "yes/no" },
];
export function InsuranceCompaniesPage() {
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const canEdit = hasPermission("insurance:write");
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["insurance-companies"],
        queryFn: async () => (await api.get("/insurance/companies")).data,
    });
    const rows = data?.data || [];
    return (_jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsx(PageHeader, { title: "Insurance companies", subtitle: `${rows.length} companies in your network lookup`, icon: _jsx(ShieldCheck, { size: 20 }), actions: canEdit && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setImporting(true), className: "inline-flex items-center gap-1.5 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 text-sm rounded-lg px-3 py-2", children: [_jsx(Upload, { size: 14 }), " Import"] }), _jsxs("button", { onClick: () => setCreating(true), className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft", children: [_jsx(Plus, { size: 14 }), " New company"] })] })) }), _jsx(Card, { children: isLoading ? (_jsx(CardBody, { children: _jsx("div", { className: "space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-10 bg-ink-100 rounded animate-pulse" }, i))) }) })) : rows.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Building2, { size: 20 }), title: "No insurance companies yet", description: "Add your network of insurers so patients can store their policies and doctors can mark accepted plans." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "Code" }), _jsx("th", { children: "Name (EN)" }), _jsx("th", { children: "Name (AR)" }), _jsx("th", { children: "Active" }), _jsx("th", {})] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: rows.map((c) => (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-2 font-mono text-[11px] text-ink-500", children: c.code }), _jsx("td", { className: "py-2", children: _jsxs("div", { className: "flex items-center gap-2", children: [c.logo_url && (_jsx("img", { src: c.logo_url, alt: "", className: "size-6 rounded ring-1 ring-ink-200 object-cover bg-white" })), _jsx("span", { className: "font-medium text-ink-800", children: c.name })] }) }), _jsx("td", { className: "py-2 text-ink-600", children: c.name_ar || "—" }), _jsx("td", { className: "py-2", children: c.active ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-emerald-700 text-xs", children: [_jsx(CheckCircle2, { size: 12 }), " Active"] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-ink-400 text-xs", children: [_jsx(XCircle, { size: 12 }), " Inactive"] })) }), _jsx("td", { className: "px-5 py-2 text-right", children: canEdit && (_jsxs("button", { onClick: () => setEditing(c), className: "text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1", children: [_jsx(Pencil, { size: 12 }), " Edit"] })) })] }, c.id))) })] }) })) }), (creating || editing) && (_jsx(CompanyModal, { company: editing, onClose: () => {
                    setCreating(false);
                    setEditing(null);
                } })), _jsx(BulkImportModal, { open: importing, onClose: () => setImporting(false), title: "Import insurance companies from Excel/CSV", entityLabel: "company", columns: COMPANY_IMPORT_COLUMNS, endpoint: "/insurance/companies/bulk-import", onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-companies"] }) })] }));
}
function CompanyModal({ company, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        code: company?.code || "",
        name: company?.name || "",
        name_ar: company?.name_ar || "",
        logo_url: company?.logo_url || "",
        active: company?.active ?? true,
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => {
            if (company)
                return (await api.patch(`/insurance/companies/${company.id}`, form)).data;
            return (await api.post("/insurance/companies", form)).data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["insurance-companies"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save company"),
    });
    const remove = useMutation({
        mutationFn: async () => {
            if (!company)
                return;
            return api.delete(`/insurance/companies/${company.id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["insurance-companies"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to delete company"),
    });
    function onSubmit(e) {
        e.preventDefault();
        save.mutate();
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(ShieldCheck, { size: 16 }), " ", company ? "Edit insurance company" : "New insurance company"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsx(Field, { label: "Name *", value: form.name, onChange: (v) => setForm({ ...form, name: v }), required: true }), _jsx(Field, { label: "Name (Arabic)", value: form.name_ar, onChange: (v) => setForm({ ...form, name_ar: v }) }), _jsx(Field, { label: "Code", value: form.code, onChange: (v) => setForm({ ...form, code: v.toUpperCase() }), placeholder: "auto-generated" }), _jsx(Field, { label: "Logo URL", value: form.logo_url, onChange: (v) => setForm({ ...form, logo_url: v }), placeholder: "https://\u2026" }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-ink-700", children: [_jsx("input", { type: "checkbox", checked: form.active, onChange: (e) => setForm({ ...form, active: e.target.checked }), className: "size-4 rounded border-ink-300" }), "Active (visible when adding patient insurance)"] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-between items-center gap-2 pt-2 border-t border-ink-100", children: [company ? (_jsxs("button", { type: "button", onClick: () => {
                                        if (confirm(`Delete insurance company "${company.name}"?`))
                                            remove.mutate();
                                    }, disabled: remove.isPending, className: "text-rose-600 hover:text-rose-800 text-sm inline-flex items-center gap-1", children: [_jsx(Trash2, { size: 14 }), " Delete"] })) : (_jsx("span", {})), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsx("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: save.isPending ? "Saving…" : company ? "Save changes" : "Create company" })] })] })] })] }) }));
}
function Field({ label, value, onChange, placeholder, required, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
