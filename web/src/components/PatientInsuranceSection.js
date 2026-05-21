import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { Badge } from "./ui/Badge";
import { Card, CardBody, CardHeader } from "./ui/Card";
export function PatientInsuranceSection({ patientId }) {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const list = useQuery({
        queryKey: ["patient-insurance", patientId],
        queryFn: async () => (await api.get(`/insurance/patients/${patientId}`)).data,
    });
    const companies = useQuery({
        queryKey: ["insurance-companies-pick"],
        queryFn: async () => (await api.get("/insurance/companies")).data,
    });
    const remove = useMutation({
        mutationFn: async (id) => api.delete(`/insurance/patient-records/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-insurance", patientId] }),
    });
    const items = list.data?.data || [];
    const companyMap = new Map((companies.data?.data || []).map((c) => [c.id, c]));
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Insurance plans", icon: _jsx(ShieldCheck, { size: 16 }), description: `${items.length} plan${items.length === 1 ? "" : "s"} on file`, action: _jsxs("button", { onClick: () => { setEditing(null); setShowForm(true); }, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-1.5 shadow-soft", children: [_jsx(Plus, { size: 14 }), " Add plan"] }) }), _jsx(CardBody, { children: items.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500", children: "No insurance plans on file." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((p) => {
                        const company = companyMap.get(p.insurance_company_id);
                        return (_jsxs("li", { className: "py-3 flex items-center gap-3 text-sm", children: [_jsx("div", { className: "size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center", children: _jsx(ShieldCheck, { size: 14 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "font-medium text-ink-800", children: [company?.name || `Company #${p.insurance_company_id}`, p.is_primary && _jsx("span", { className: "ml-2 text-[10px] uppercase tracking-wider text-brand-600 font-semibold", children: "primary" })] }), _jsxs("div", { className: "text-xs text-ink-500", children: [p.network_tier || "—", p.member_number && _jsxs(_Fragment, { children: [" \u00B7 member ", _jsx("span", { className: "font-mono", children: p.member_number })] }), p.expiry_date && _jsxs(_Fragment, { children: [" \u00B7 exp ", p.expiry_date] }), p.copayment != null && _jsxs(_Fragment, { children: [" \u00B7 co-pay ", p.copayment] })] })] }), _jsx(Badge, { tone: "info", children: (p.status || "").replaceAll("_", " ") }), _jsxs("button", { onClick: () => { setEditing(p); setShowForm(true); }, className: "text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1", children: [_jsx(Pencil, { size: 12 }), " Edit"] }), _jsxs("button", { onClick: () => confirm("Remove this plan?") && remove.mutate(p.id), className: "text-xs text-rose-600 hover:text-rose-800 inline-flex items-center gap-1", children: [_jsx(Trash2, { size: 12 }), " Delete"] })] }, p.id));
                    }) })) }), showForm && (_jsx(PlanForm, { patientId: patientId, existing: editing, companies: (companies.data?.data || []), onClose: () => setShowForm(false) }))] }));
}
function PlanForm({ patientId, existing, companies, onClose, }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        insurance_company_id: existing?.insurance_company_id || (companies[0]?.id ?? ""),
        policy_number: existing?.policy_number || "",
        member_number: existing?.member_number || "",
        network_tier: existing?.network_tier || "",
        coverage_type: existing?.coverage_type || "",
        expiry_date: existing?.expiry_date || "",
        deductible: existing?.deductible ?? "",
        copayment: existing?.copayment ?? "",
        approval_required: existing?.approval_required ?? true,
        is_primary: existing?.is_primary ?? true,
    });
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async () => {
            const payload = {
                ...form,
                insurance_company_id: Number(form.insurance_company_id),
                deductible: form.deductible ? Number(form.deductible) : null,
                copayment: form.copayment ? Number(form.copayment) : null,
            };
            if (!payload.expiry_date)
                delete payload.expiry_date;
            if (existing)
                return (await api.patch(`/insurance/patient-records/${existing.id}`, payload)).data;
            return (await api.post(`/insurance/patients/${patientId}`, payload)).data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["patient-insurance", patientId] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save plan"),
    });
    function onSubmit(e) {
        e.preventDefault();
        setError(null);
        save.mutate();
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-lg bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(ShieldCheck, { size: 16 }), " ", existing ? "Edit insurance plan" : "Add insurance plan"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: "Insurance company *" }), _jsx("select", { value: form.insurance_company_id, onChange: (e) => setForm({ ...form, insurance_company_id: e.target.value }), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", required: true, children: companies.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id)) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "Member number", value: form.member_number, onChange: (v) => setForm({ ...form, member_number: v }) }), _jsx(Field, { label: "Policy number", value: form.policy_number, onChange: (v) => setForm({ ...form, policy_number: v }) }), _jsx(Field, { label: "Network tier", value: form.network_tier, onChange: (v) => setForm({ ...form, network_tier: v }), placeholder: "Gold / Silver" }), _jsx(Field, { label: "Coverage type", value: form.coverage_type, onChange: (v) => setForm({ ...form, coverage_type: v }), placeholder: "employee / family" }), _jsx(Field, { label: "Expiry date", type: "date", value: form.expiry_date, onChange: (v) => setForm({ ...form, expiry_date: v }) }), _jsx(Field, { label: "Deductible", type: "number", value: form.deductible, onChange: (v) => setForm({ ...form, deductible: v }) }), _jsx(Field, { label: "Co-payment", type: "number", value: form.copayment, onChange: (v) => setForm({ ...form, copayment: v }) })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Toggle, { label: "Primary plan", checked: form.is_primary, onChange: (v) => setForm({ ...form, is_primary: v }) }), _jsx(Toggle, { label: "Approval required", checked: form.approval_required, onChange: (v) => setForm({ ...form, approval_required: v }) })] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsx("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: save.isPending ? "Saving…" : existing ? "Save changes" : "Add plan" })] })] })] }) }));
}
function Field({ label, value, onChange, placeholder, type, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { type: type || "text", value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: placeholder, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
function Toggle({ label, checked, onChange }) {
    return (_jsxs("button", { type: "button", onClick: () => onChange(!checked), className: "flex items-center gap-2 text-sm", children: [_jsx("span", { className: `w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`, children: _jsx("span", { className: "size-5 rounded-full bg-white shadow-soft" }) }), _jsx("span", { className: "text-ink-700", children: label })] }));
}
