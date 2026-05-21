import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Globe, PauseCircle, Plus, X } from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";
export function TenantsPage() {
    const roles = useAuthStore((s) => s.user?.roles || []);
    const isSuper = roles.includes("super_admin");
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ["tenants-list"],
        queryFn: async () => (await api.get("/tenants/")).data,
    });
    const toggle = useMutation({
        mutationFn: async ({ id, is_active }) => api.patch(`/tenants/${id}`, { is_active }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants-list"] }),
    });
    const items = data?.data || [];
    return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-6", children: [_jsx(PageHeader, { title: "Tenants", subtitle: isSuper
                    ? "Every medical center / hospital network hosted on this MedMeAI install"
                    : "Your organisation", icon: _jsx(Building2, { size: 20 }), actions: isSuper && (_jsxs("button", { onClick: () => setShowCreate(true), className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft", children: [_jsx(Plus, { size: 14 }), " New tenant"] })) }), _jsx(Card, { children: isLoading ? (_jsx(CardBody, { children: _jsx("div", { className: "space-y-2", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-12 bg-ink-100 rounded animate-pulse" }, i))) }) })) : items.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Building2, { size: 20 }), title: "No tenants yet", description: "Create the first medical center to onboard onto MedMeAI." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((t) => (_jsxs("li", { className: "p-4 flex items-center gap-3 hover:bg-ink-50/60 transition", children: [_jsx(Avatar, { name: t.name, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-ink-800", children: t.name }), _jsxs("div", { className: "text-xs text-ink-500", children: [_jsx("span", { className: "font-mono", children: t.slug }), t.name_ar && _jsxs(_Fragment, { children: [" \u00B7 ", t.name_ar] })] })] }), _jsx(Badge, { tone: t.is_active ? "success" : "neutral", dot: true, pulse: t.is_active, children: t.is_active ? "active" : "inactive" }), isSuper && (_jsx("button", { onClick: () => toggle.mutate({ id: t.id, is_active: !t.is_active }), className: "text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1", children: t.is_active ? _jsxs(_Fragment, { children: [_jsx(PauseCircle, { size: 12 }), " Deactivate"] }) : _jsxs(_Fragment, { children: [_jsx(CheckCircle2, { size: 12 }), " Activate"] }) }))] }, t.id))) })) }), showCreate && _jsx(CreateTenantModal, { onClose: () => setShowCreate(false) })] }));
}
function CreateTenantModal({ onClose }) {
    const qc = useQueryClient();
    const [slug, setSlug] = useState("");
    const [name, setName] = useState("");
    const [nameAr, setNameAr] = useState("");
    const [error, setError] = useState(null);
    const create = useMutation({
        mutationFn: async (body) => (await api.post("/tenants/", body)).data,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["tenants-list"] });
            qc.invalidateQueries({ queryKey: ["tenants-switcher"] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to create tenant"),
    });
    function onSubmit(e) {
        e.preventDefault();
        setError(null);
        create.mutate({ slug, name, name_ar: nameAr || undefined });
    }
    function suggestSlug() {
        const s = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");
        if (s)
            setSlug(s);
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-md bg-white rounded-2xl shadow-lift", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Globe, { size: 16 }), " Onboard a new medical center"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-3", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Name (English)" }), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), onBlur: () => !slug && suggestSlug(), required: true, placeholder: "Royal Medical Center", className: "mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Name (Arabic) \u2014 optional" }), _jsx("input", { value: nameAr, onChange: (e) => setNameAr(e.target.value), placeholder: "\u0627\u0644\u0645\u0631\u0643\u0632 \u0627\u0644\u0637\u0628\u064A \u0627\u0644\u0645\u0644\u0643\u064A", className: "mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Slug (URL-safe id)" }), _jsx("input", { value: slug, onChange: (e) => setSlug(e.target.value), required: true, placeholder: "royal-medical", className: "mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsx("span", { className: "text-xs text-ink-500 mt-1 inline-block", children: "Used internally and in URLs." })] }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: create.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: [_jsx(Plus, { size: 14 }), " ", create.isPending ? "Creating…" : "Create tenant"] })] })] })] }) }));
}
