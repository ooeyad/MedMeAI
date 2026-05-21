import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, X } from "lucide-react";
import { api } from "../api/client";
export function MoveTenantDialog({ open, onClose, entityKind, entityId, entityName, currentTenantId, onSuccess, }) {
    const qc = useQueryClient();
    const [target, setTarget] = useState(null);
    const [error, setError] = useState(null);
    const tenants = useQuery({
        queryKey: ["tenants-pick"],
        queryFn: async () => (await api.get("/tenants/")).data,
        enabled: open,
    });
    const move = useMutation({
        mutationFn: async () => api.post(`/${entityKind === "doctor" ? "doctors" : "patients"}/${entityId}/move-tenant`, {
            tenant_id: target,
        }),
        onSuccess: () => {
            qc.invalidateQueries();
            onSuccess?.();
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to move tenant"),
    });
    if (!open)
        return null;
    const list = (tenants.data?.data || []).filter((t) => t.id !== currentTenantId);
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Building2, { size: 16 }), " Move to another tenant"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("p", { className: "text-sm text-ink-600", children: ["Move ", _jsx("span", { className: "font-semibold text-ink-800", children: entityName }), " to a different tenant. All related ", entityKind === "doctor" ? "appointments" : "appointments + KYC + insurance", " will follow."] }), list.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500 italic", children: "No other tenants available. Create one in the Tenants page first." })) : (_jsx("div", { className: "space-y-1", children: list.map((t) => (_jsxs("button", { onClick: () => setTarget(t.id), className: `w-full text-left rounded-lg border p-3 flex items-center gap-3 transition ${target === t.id
                                    ? "border-brand-500 bg-brand-50"
                                    : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/30"}`, children: [_jsx(Building2, { size: 16, className: "text-ink-500" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-ink-800", children: t.name }), _jsx("div", { className: "text-xs text-ink-500 font-mono", children: t.slug })] }), target === t.id && _jsx(ArrowRight, { size: 14, className: "text-brand-600" })] }, t.id))) })), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { onClick: () => target && move.mutate(), disabled: !target || move.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: [_jsx(ArrowRight, { size: 14 }), " ", move.isPending ? "Moving…" : "Move"] })] })] })] }) }));
}
