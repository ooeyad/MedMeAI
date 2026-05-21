import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Plus, Receipt, ShieldCheck, Trash2, X, XCircle, } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
const STATUS_TONES = {
    draft: "neutral", open: "info", paid: "success", partial: "warning", void: "neutral", refunded: "danger",
};
export function InvoiceDetailPage() {
    const { id } = useParams();
    const invoiceId = Number(id);
    const qc = useQueryClient();
    const [showAddLine, setShowAddLine] = useState(false);
    const [showAddPayment, setShowAddPayment] = useState(false);
    const inv = useQuery({
        queryKey: ["invoice", invoiceId],
        queryFn: async () => (await api.get(`/billing/invoices/${invoiceId}`)).data,
        enabled: !!invoiceId,
    });
    const patient = useQuery({
        queryKey: ["invoice-patient", inv.data?.patient_id],
        queryFn: async () => (await api.get(`/patients/${inv.data?.patient_id}`)).data,
        enabled: !!inv.data?.patient_id,
    });
    const removeLine = useMutation({
        mutationFn: async (lineId) => api.delete(`/billing/invoices/${invoiceId}/lines/${lineId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
    });
    const voidInv = useMutation({
        mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/void`, {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
    });
    if (!inv.data) {
        return _jsx("div", { className: "max-w-5xl mx-auto p-8 text-ink-500", children: "Loading\u2026" });
    }
    const i = inv.data;
    return (_jsxs("div", { className: "max-w-5xl mx-auto space-y-5", children: [_jsxs(Link, { to: "/invoices", className: "inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700", children: [_jsx(ArrowLeft, { size: 12 }), " Back to invoices"] }), _jsx(Card, { children: _jsxs(CardBody, { children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h1", { className: "text-xl font-semibold text-ink-900 font-mono", children: i.code }), _jsx(Badge, { tone: STATUS_TONES[i.status] || "neutral", dot: true, pulse: i.status === "open", children: i.status })] }), _jsxs("div", { className: "text-sm text-ink-500 mt-1", children: ["Patient:", " ", patient.data ? (_jsx(Link, { to: `/patients/${patient.data.id}`, className: "text-brand-700 hover:underline", children: patient.data.full_name_en })) : "…", i.issued_at && _jsxs(_Fragment, { children: [" \u00B7 Issued ", i.issued_at.slice(0, 16).replace("T", " ")] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [i.status !== "void" && i.status !== "paid" && (_jsxs("button", { onClick: () => setShowAddPayment(true), className: "inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-3 py-2 shadow-soft", children: [_jsx(Banknote, { size: 14 }), " Record payment"] })), i.status !== "void" && (_jsxs("button", { onClick: () => confirm("Void this invoice?") && voidInv.mutate(), className: "inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm rounded-lg px-3 py-2", children: [_jsx(XCircle, { size: 14 }), " Void"] }))] })] }), _jsxs("div", { className: "mt-5 grid grid-cols-2 md:grid-cols-4 gap-3", children: [_jsx(Total, { label: "Subtotal", value: i.subtotal, currency: i.currency }), _jsx(Total, { label: "Tax", value: i.tax_total, currency: i.currency }), _jsx(Total, { label: "Total", value: i.total, currency: i.currency, accent: "brand" }), _jsx(Total, { label: "Balance", value: i.balance, currency: i.currency, accent: Number(i.balance) > 0 ? "rose" : "emerald" }), _jsx(Total, { label: "Patient share", value: i.patient_share, currency: i.currency }), _jsx(Total, { label: "Insurance share", value: i.insurance_share, currency: i.currency, icon: _jsx(ShieldCheck, { size: 12 }) }), _jsx(Total, { label: "Paid", value: i.paid_total, currency: i.currency, accent: "emerald", icon: _jsx(CheckCircle2, { size: 12 }) })] })] }) }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Line items", icon: _jsx(Receipt, { size: 16 }), description: `${i.lines?.length || 0} line${(i.lines?.length || 0) === 1 ? "" : "s"}`, action: i.status !== "void" && (_jsxs("button", { onClick: () => setShowAddLine(true), className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-1.5 shadow-soft", children: [_jsx(Plus, { size: 14 }), " Add line"] })) }), _jsx(CardBody, { children: (i.lines || []).length === 0 ? (_jsx("p", { className: "text-sm text-ink-500 py-3", children: "No line items yet." })) : (_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-100", children: [_jsx("th", { className: "py-2", children: "Description" }), _jsx("th", { className: "text-right", children: "Qty" }), _jsx("th", { className: "text-right", children: "Unit" }), _jsx("th", { className: "text-right", children: "Discount %" }), _jsx("th", { className: "text-right", children: "Tax %" }), _jsx("th", { className: "text-right", children: "Total" }), _jsx("th", {})] }) }), _jsx("tbody", { className: "divide-y divide-ink-100", children: (i.lines || []).map((l) => (_jsxs("tr", { children: [_jsx("td", { className: "py-2 text-ink-800", children: l.description }), _jsx("td", { className: "py-2 text-right tabular-nums", children: l.quantity }), _jsx("td", { className: "py-2 text-right tabular-nums", children: Number(l.unit_price).toFixed(2) }), _jsx("td", { className: "py-2 text-right tabular-nums", children: Number(l.discount_percent).toFixed(2) }), _jsx("td", { className: "py-2 text-right tabular-nums", children: Number(l.tax_rate_percent).toFixed(2) }), _jsx("td", { className: "py-2 text-right font-medium tabular-nums", children: Number(l.line_total).toFixed(2) }), _jsx("td", { className: "py-2 text-right", children: i.status !== "void" && (_jsx("button", { onClick: () => removeLine.mutate(l.id), className: "text-rose-600 hover:text-rose-800", children: _jsx(Trash2, { size: 12 }) })) })] }, l.id))) })] })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Payments", icon: _jsx(CreditCard, { size: 16 }), description: `${i.payments?.length || 0} payment${(i.payments?.length || 0) === 1 ? "" : "s"}` }), _jsx(CardBody, { children: (i.payments || []).length === 0 ? (_jsx("p", { className: "text-sm text-ink-500 py-3", children: "No payments recorded yet." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: (i.payments || []).map((p) => (_jsxs("li", { className: "py-2 flex items-center gap-3 text-sm", children: [_jsx(Badge, { tone: "info", children: p.method.replaceAll("_", " ") }), _jsx("span", { className: "text-ink-600", children: p.paid_at?.slice(0, 16).replace("T", " ") }), p.reference && _jsxs("span", { className: "font-mono text-xs text-ink-500", children: ["ref ", p.reference] }), _jsx("span", { className: "flex-1" }), _jsxs("span", { className: "font-medium text-ink-800 tabular-nums", children: [Number(p.amount).toFixed(2), " ", p.currency] })] }, p.id))) })) })] }), showAddLine && _jsx(AddLineModal, { invoiceId: invoiceId, onClose: () => setShowAddLine(false) }), showAddPayment && _jsx(AddPaymentModal, { invoiceId: invoiceId, balance: Number(i.balance), onClose: () => setShowAddPayment(false) })] }));
}
function Total({ label, value, currency, accent, icon, }) {
    const color = accent === "emerald" ? "text-emerald-700"
        : accent === "rose" ? "text-rose-700"
            : accent === "brand" ? "text-brand-700"
                : "text-ink-800";
    return (_jsxs("div", { className: "rounded-lg bg-ink-50 px-3 py-2", children: [_jsxs("div", { className: "text-[11px] text-ink-500 uppercase tracking-wider flex items-center gap-1", children: [icon, label] }), _jsxs("div", { className: `mt-0.5 font-semibold tabular-nums ${color}`, children: [Number(value).toFixed(2), " ", currency] })] }));
}
function AddLineModal({ invoiceId, onClose }) {
    const qc = useQueryClient();
    const items = useQuery({
        queryKey: ["items-pick"],
        queryFn: async () => (await api.get("/billing/items", { params: { page_size: 200 } })).data,
    });
    const [form, setForm] = useState({
        item_id: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_rate_percent: 0,
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/lines`, {
            item_id: form.item_id ? Number(form.item_id) : undefined,
            description: form.description,
            quantity: Number(form.quantity) || 1,
            unit_price: Number(form.unit_price) || 0,
            discount_percent: Number(form.discount_percent) || 0,
            tax_rate_percent: Number(form.tax_rate_percent) || 0,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to add line"),
    });
    function pickItem(id) {
        const item = (items.data?.data || []).find((i) => String(i.id) === id);
        setForm({
            ...form,
            item_id: id,
            description: item?.name || form.description,
            unit_price: item?.default_price ?? form.unit_price,
            tax_rate_percent: item?.tax_rate_percent ?? form.tax_rate_percent,
        });
    }
    function onSubmit(e) { e.preventDefault(); save.mutate(); }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-lg bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Plus, { size: 16 }), " Add line"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: "Item (optional \u2014 auto-fills price)" }), _jsxs("select", { value: form.item_id, onChange: (e) => pickItem(e.target.value), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: [_jsx("option", { value: "", children: "\u2014 ad-hoc \u2014" }), (items.data?.data || []).map((it) => (_jsxs("option", { value: it.id, children: [it.name, " \u00B7 ", Number(it.default_price).toFixed(2)] }, it.id)))] })] }), _jsx(Field, { label: "Description *", value: form.description, onChange: (v) => setForm({ ...form, description: v }), required: true }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "Quantity", type: "number", value: form.quantity, onChange: (v) => setForm({ ...form, quantity: v }) }), _jsx(Field, { label: "Unit price", type: "number", value: form.unit_price, onChange: (v) => setForm({ ...form, unit_price: v }) }), _jsx(Field, { label: "Discount %", type: "number", value: form.discount_percent, onChange: (v) => setForm({ ...form, discount_percent: v }) }), _jsx(Field, { label: "Tax %", type: "number", value: form.tax_rate_percent, onChange: (v) => setForm({ ...form, tax_rate_percent: v }) })] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: save.isPending, className: "bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft inline-flex items-center gap-1.5", children: [_jsx(Plus, { size: 14 }), " ", save.isPending ? "Adding…" : "Add line"] })] })] })] }) }));
}
function AddPaymentModal({ invoiceId, balance, onClose }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        method: "cash", amount: balance, reference: "", notes: "",
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/payments`, {
            ...form,
            amount: Number(form.amount),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to record payment"),
    });
    function onSubmit(e) { e.preventDefault(); save.mutate(); }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Banknote, { size: 16 }), " Record payment"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: "Method *" }), _jsxs("select", { value: form.method, onChange: (e) => setForm({ ...form, method: e.target.value }), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "bank_transfer", children: "Bank transfer" }), _jsx("option", { value: "insurance", children: "Insurance" }), _jsx("option", { value: "cheque", children: "Cheque" }), _jsx("option", { value: "online", children: "Online" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsx(Field, { label: "Amount *", type: "number", value: form.amount, onChange: (v) => setForm({ ...form, amount: v }), required: true }), _jsx(Field, { label: "Reference (card auth / cheque #)", value: form.reference, onChange: (v) => setForm({ ...form, reference: v }) }), _jsx(Field, { label: "Notes", value: form.notes, onChange: (v) => setForm({ ...form, notes: v }) }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: save.isPending, className: "bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft inline-flex items-center gap-1.5", children: [_jsx(Banknote, { size: 14 }), " ", save.isPending ? "Recording…" : "Record"] })] })] })] }) }));
}
function Field({ label, value, onChange, placeholder, required, type, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value ?? "", type: type || "text", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
