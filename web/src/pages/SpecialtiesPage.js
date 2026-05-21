import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Stethoscope, Trash2, Upload, X } from "lucide-react";
import { api } from "../api/client";
import { BulkImportModal } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";
const SPECIALTY_IMPORT_COLUMNS = [
    { key: "name", header: "Name", required: true, aliases: ["specialty", "english name"] },
    { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name", "name ar"] },
    { key: "slug", header: "Slug", hint: "Auto-generated from name if blank" },
    { key: "description", header: "Description", aliases: ["notes"] },
];
export function SpecialtiesPage() {
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const canEdit = hasPermission("doctors:write");
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["specialties"],
        queryFn: async () => (await api.get("/doctors/specialties")).data,
    });
    const rows = data?.data || [];
    return (_jsxs("div", { className: "max-w-5xl mx-auto", children: [_jsx(PageHeader, { title: "Medical specialties", subtitle: `${rows.length} specialties in your lookup`, icon: _jsx(Stethoscope, { size: 20 }), actions: canEdit && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setImporting(true), className: "inline-flex items-center gap-1.5 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 text-sm rounded-lg px-3 py-2", children: [_jsx(Upload, { size: 14 }), " Import"] }), _jsxs("button", { onClick: () => setCreating(true), className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft", children: [_jsx(Plus, { size: 14 }), " New specialty"] })] })) }), _jsx(Card, { children: isLoading ? (_jsx(CardBody, { children: _jsx("div", { className: "space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-10 bg-ink-100 rounded animate-pulse" }, i))) }) })) : rows.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Stethoscope, { size: 20 }), title: "No specialties yet", description: "Add cardiology, dermatology, paediatrics, etc., so doctors can be tagged with their specialty." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "Slug" }), _jsx("th", { children: "Name (EN)" }), _jsx("th", { children: "Name (AR)" }), _jsx("th", { children: "Description" }), _jsx("th", {})] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: rows.map((s) => (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-2 font-mono text-[11px] text-ink-500", children: s.slug }), _jsx("td", { className: "py-2 font-medium text-ink-800", children: s.name }), _jsx("td", { className: "py-2 text-ink-600", children: s.name_ar || "—" }), _jsx("td", { className: "py-2 text-ink-500 max-w-md truncate", children: s.description || "—" }), _jsx("td", { className: "px-5 py-2 text-right", children: canEdit && (_jsxs("button", { onClick: () => setEditing(s), className: "text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1", children: [_jsx(Pencil, { size: 12 }), " Edit"] })) })] }, s.id))) })] }) })) }), (creating || editing) && (_jsx(SpecialtyModal, { specialty: editing, onClose: () => {
                    setCreating(false);
                    setEditing(null);
                } })), _jsx(BulkImportModal, { open: importing, onClose: () => setImporting(false), title: "Import specialties from Excel/CSV", entityLabel: "specialty", columns: SPECIALTY_IMPORT_COLUMNS, endpoint: "/doctors/specialties/bulk-import", onSuccess: () => qc.invalidateQueries({ queryKey: ["specialties"] }) })] }));
}
function SpecialtyModal({ specialty, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        slug: specialty?.slug || "",
        name: specialty?.name || "",
        name_ar: specialty?.name_ar || "",
        description: specialty?.description || "",
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => {
            if (specialty)
                return (await api.patch(`/doctors/specialties/${specialty.id}`, form)).data;
            return (await api.post("/doctors/specialties", form)).data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["specialties"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save specialty"),
    });
    const remove = useMutation({
        mutationFn: async () => {
            if (!specialty)
                return;
            return api.delete(`/doctors/specialties/${specialty.id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["specialties"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to delete specialty"),
    });
    function onSubmit(e) {
        e.preventDefault();
        save.mutate();
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Stethoscope, { size: 16 }), " ", specialty ? "Edit specialty" : "New specialty"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsx(Field, { label: "Name *", value: form.name, onChange: (v) => setForm({ ...form, name: v }), required: true }), _jsx(Field, { label: "Name (Arabic)", value: form.name_ar, onChange: (v) => setForm({ ...form, name_ar: v }) }), _jsx(Field, { label: "Slug", value: form.slug, onChange: (v) => setForm({ ...form, slug: v }), placeholder: "auto-generated from name" }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: "Description" }), _jsx("textarea", { value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), rows: 3, className: "mt-1 w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-between items-center gap-2 pt-2 border-t border-ink-100", children: [specialty ? (_jsxs("button", { type: "button", onClick: () => {
                                        if (confirm(`Delete specialty "${specialty.name}"?`))
                                            remove.mutate();
                                    }, disabled: remove.isPending, className: "text-rose-600 hover:text-rose-800 text-sm inline-flex items-center gap-1", children: [_jsx(Trash2, { size: 14 }), " Delete"] })) : (_jsx("span", {})), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsx("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: save.isPending ? "Saving…" : specialty ? "Save changes" : "Create specialty" })] })] })] })] }) }));
}
function Field({ label, value, onChange, placeholder, required, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
