import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Beaker, DollarSign, FlaskConical, Pencil, Pill, Plus, Search, Stethoscope, Tag, Upload, Wrench, X } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { BulkImportModal } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";
const ITEM_IMPORT_COLUMNS = [
    { key: "name", header: "Name", required: true, aliases: ["item", "item name", "product"] },
    { key: "sku", header: "SKU", aliases: ["code"], hint: "Auto-generated if blank" },
    { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name", "name ar"] },
    { key: "kind", header: "Kind", aliases: ["type", "category"], hint: "consultation, medication, lab_test, imaging, procedure, supply, other" },
    { key: "default_price", header: "Price", aliases: ["default price", "amount", "cost"] },
    { key: "tax_rate_percent", header: "Tax %", aliases: ["tax", "tax percent"] },
    { key: "unit", header: "Unit", aliases: ["uom"] },
    { key: "description", header: "Description", aliases: ["notes"] },
    { key: "is_active", header: "Active", aliases: ["enabled"] },
];
const KIND_TONE = {
    consultation: "brand",
    medication: "info",
    lab_test: "violet",
    imaging: "amber",
    procedure: "success",
    supply: "neutral",
    other: "neutral",
};
const KIND_META = {
    medication: {
        title: "Medications",
        subtitle: "Prescription catalog — shown as quick-picks in the consultation prescription form",
        icon: _jsx(Pill, { size: 20 }),
        addLabel: "New medication",
        emptyDesc: "Add medications doctors prescribe most often so they show as quick-picks during consultations.",
    },
    lab_test: {
        title: "Laboratory tests",
        subtitle: "Lab catalog — shown as quick-picks under Lab tests in consultations",
        icon: _jsx(FlaskConical, { size: 20 }),
        addLabel: "New lab test",
        emptyDesc: "Add tests your lab runs (CBC, HbA1c, lipid panel, …) so doctors can order them in one click.",
    },
    imaging: {
        title: "Imaging studies",
        subtitle: "Radiology catalog — shown as quick-picks under Imaging & procedures",
        icon: _jsx(Beaker, { size: 20 }),
        addLabel: "New imaging study",
        emptyDesc: "Add X-ray, ultrasound, CT, MRI and other imaging studies you offer.",
    },
    procedure: {
        title: "Procedures",
        subtitle: "Procedural catalog — shown as quick-picks under Imaging & procedures",
        icon: _jsx(Wrench, { size: 20 }),
        addLabel: "New procedure",
        emptyDesc: "Add wound dressings, injections, minor surgical procedures, ECG, etc.",
    },
    consultation: {
        title: "Consultation fees",
        subtitle: "Consultation pricing — used to auto-create invoices when an appointment completes",
        icon: _jsx(Stethoscope, { size: 20 }),
        addLabel: "New consultation fee",
        emptyDesc: "Add general, specialist, and follow-up consultation fees.",
    },
};
export function PriceListPage() {
    const [params, setParams] = useSearchParams();
    const urlKind = params.get("kind") || "";
    const [q, setQ] = useState("");
    const [kind, setKind] = useState(urlKind);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const canEdit = hasPermission("users:write");
    const qc = useQueryClient();
    // Keep URL ?kind=… in sync with the dropdown so deep-links from the sidebar work.
    useEffect(() => { setKind(urlKind); }, [urlKind]);
    function selectKind(newKind) {
        setKind(newKind);
        if (newKind)
            setParams({ kind: newKind }, { replace: true });
        else
            setParams({}, { replace: true });
    }
    const { data, isLoading } = useQuery({
        queryKey: ["items", q, kind],
        queryFn: async () => (await api.get("/billing/items", { params: { q, kind: kind || undefined, page_size: 200 } })).data,
    });
    const items = data?.data || [];
    const meta = KIND_META[kind];
    const pageTitle = meta?.title || "Price list";
    const pageSubtitle = meta?.subtitle || `${data?.meta?.total ?? 0} items across your full catalog`;
    const pageIcon = meta?.icon || _jsx(DollarSign, { size: 20 });
    const newButtonLabel = meta?.addLabel || "New item";
    return (_jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsx(PageHeader, { title: pageTitle, subtitle: pageSubtitle, icon: pageIcon, actions: _jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: "Name or SKU", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-56" })] }), _jsxs("select", { value: kind, onChange: (e) => selectKind(e.target.value), className: "h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300", children: [_jsx("option", { value: "", children: "All kinds" }), Object.keys(KIND_TONE).map((k) => (_jsx("option", { value: k, children: k.replaceAll("_", " ") }, k)))] }), canEdit && (_jsxs("button", { onClick: () => setImporting(true), className: "inline-flex items-center gap-1.5 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 text-sm rounded-lg px-3 py-2", children: [_jsx(Upload, { size: 14 }), " Import"] })), canEdit && (_jsxs("button", { onClick: () => setCreating(true), className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft", children: [_jsx(Plus, { size: 14 }), " ", newButtonLabel] }))] }) }), _jsx(Card, { children: isLoading ? (_jsx(CardBody, { children: _jsx("div", { className: "space-y-2", children: Array.from({ length: 5 }).map((_, i) => (_jsx("div", { className: "h-10 bg-ink-100 rounded animate-pulse" }, i))) }) })) : items.length === 0 ? (_jsx(EmptyState, { icon: meta?.icon || _jsx(Tag, { size: 20 }), title: meta ? `No ${meta.title.toLowerCase()} yet` : "No items in this catalog yet", description: meta?.emptyDesc || "Add consultation fees, medications, lab tests, imaging and procedures." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "px-5 py-3", children: "SKU" }), _jsx("th", { children: "Item" }), _jsx("th", { children: "Kind" }), _jsx("th", { children: "Unit" }), _jsx("th", { className: "text-right", children: "Price" }), _jsx("th", { className: "text-right", children: "Tax %" }), _jsx("th", {})] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: items.map((it) => (_jsxs("tr", { className: "hover:bg-ink-50/60 transition", children: [_jsx("td", { className: "px-5 py-2 font-mono text-[11px] text-ink-500", children: it.sku }), _jsxs("td", { className: "py-2", children: [_jsx("div", { className: "font-medium text-ink-800", children: it.name }), it.name_ar && _jsx("div", { className: "text-xs text-ink-500", children: it.name_ar })] }), _jsx("td", { className: "py-2", children: _jsx(Badge, { tone: KIND_TONE[it.kind] || "neutral", children: it.kind.replaceAll("_", " ") }) }), _jsx("td", { className: "py-2 text-ink-600", children: it.unit || "—" }), _jsx("td", { className: "py-2 text-right font-medium text-ink-800 tabular-nums", children: it.default_price.toFixed(2) }), _jsx("td", { className: "py-2 text-right text-ink-600 tabular-nums", children: it.tax_rate_percent.toFixed(2) }), _jsx("td", { className: "px-5 py-2 text-right", children: canEdit && (_jsxs("button", { onClick: () => setEditing(it), className: "text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1", children: [_jsx(Pencil, { size: 12 }), " Edit"] })) })] }, it.id))) })] }) })) }), (creating || editing) && (_jsx(ItemModal, { item: editing, defaultKind: kind || "consultation", onClose: () => { setCreating(false); setEditing(null); } })), _jsx(BulkImportModal, { open: importing, onClose: () => setImporting(false), title: kind ? `Import ${meta?.title?.toLowerCase() || "items"} from Excel/CSV` : "Import items from Excel/CSV", entityLabel: kind === "medication" ? "medication" : kind === "lab_test" ? "lab test" : kind === "imaging" ? "imaging study" : kind === "procedure" ? "procedure" : kind === "consultation" ? "consultation fee" : "item", columns: ITEM_IMPORT_COLUMNS, endpoint: "/billing/items/bulk-import", extraPayload: kind ? { kind } : undefined, onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }) })] }));
}
function ItemModal({ item, defaultKind, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        sku: item?.sku || "",
        name: item?.name || "",
        name_ar: item?.name_ar || "",
        kind: item?.kind || defaultKind,
        default_price: item?.default_price ?? 0,
        tax_rate_percent: item?.tax_rate_percent ?? 0,
        unit: item?.unit || "",
        is_active: item?.is_active ?? true,
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => {
            const payload = {
                ...form,
                default_price: Number(form.default_price) || 0,
                tax_rate_percent: Number(form.tax_rate_percent) || 0,
            };
            if (item)
                return (await api.patch(`/billing/items/${item.id}`, payload)).data;
            return (await api.post("/billing/items", payload)).data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["items"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save item"),
    });
    function onSubmit(e) {
        e.preventDefault();
        save.mutate();
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Tag, { size: 16 }), " ", item ? "Edit item" : "New item"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "SKU *", value: form.sku, onChange: (v) => setForm({ ...form, sku: v }), required: true }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: "Kind *" }), _jsx("select", { value: form.kind, onChange: (e) => setForm({ ...form, kind: e.target.value }), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: Object.keys(KIND_TONE).map((k) => (_jsx("option", { value: k, children: k.replaceAll("_", " ") }, k))) })] }), _jsx(Field, { label: "Name *", value: form.name, onChange: (v) => setForm({ ...form, name: v }), required: true }), _jsx(Field, { label: "Name (Arabic)", value: form.name_ar, onChange: (v) => setForm({ ...form, name_ar: v }) }), _jsx(Field, { label: "Default price *", type: "number", value: form.default_price, onChange: (v) => setForm({ ...form, default_price: v }), required: true }), _jsx(Field, { label: "Tax %", type: "number", value: form.tax_rate_percent, onChange: (v) => setForm({ ...form, tax_rate_percent: v }) }), _jsx(Field, { label: "Unit", value: form.unit, onChange: (v) => setForm({ ...form, unit: v }), placeholder: "visit, tab, test\u2026" })] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsx("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: save.isPending ? "Saving…" : item ? "Save changes" : "Create item" })] })] })] }) }));
}
function Field({ label, value, onChange, placeholder, required, type, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value ?? "", type: type || "text", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
