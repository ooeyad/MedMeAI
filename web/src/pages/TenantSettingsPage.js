import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Globe, Image as ImageIcon, Palette, Phone, Save, Settings as SettingsIcon, Sparkles, Mail, } from "lucide-react";
import { api } from "../api/client";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";
import { useTenantStore } from "../store/tenant";
export function TenantSettingsPage() {
    const userTenantId = useAuthStore((s) => s.user?.tenant_id);
    const tenantFromStore = useTenantStore((s) => s.tenant?.id);
    const refreshTenant = useTenantStore((s) => s.fetch);
    // Fall back to the tenant fetched at app boot if the cached login session
    // doesn't have a tenant_id (e.g. user signed in before tenancy launched).
    const tenantId = userTenantId ?? tenantFromStore;
    const tenantQ = useQuery({
        queryKey: ["tenant", tenantId],
        queryFn: async () => (await api.get(`/tenants/${tenantId}`)).data,
        enabled: !!tenantId,
    });
    const settingsQ = useQuery({
        queryKey: ["tenant-settings", tenantId],
        queryFn: async () => (await api.get(`/tenants/${tenantId}/settings`)).data,
        enabled: !!tenantId,
    });
    const [form, setForm] = useState({});
    const [tenantForm, setTenantForm] = useState({});
    useEffect(() => {
        if (settingsQ.data)
            setForm(settingsQ.data);
    }, [settingsQ.data]);
    useEffect(() => {
        if (tenantQ.data)
            setTenantForm({ name: tenantQ.data.name, name_ar: tenantQ.data.name_ar });
    }, [tenantQ.data]);
    const qc = useQueryClient();
    const saveTenant = useMutation({
        mutationFn: async () => api.patch(`/tenants/${tenantId}`, tenantForm),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant", tenantId] }); refreshTenant(); },
    });
    const saveSettings = useMutation({
        mutationFn: async () => api.put(`/tenants/${tenantId}/settings`, form),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-settings", tenantId] }); refreshTenant(); },
    });
    if (!tenantId) {
        return (_jsxs("div", { className: "max-w-3xl mx-auto", children: [_jsx(PageHeader, { title: "Tenant Settings", icon: _jsx(SettingsIcon, { size: 20 }) }), _jsx(Card, { children: _jsx(CardBody, { children: "You're not attached to a tenant." }) })] }));
    }
    function toggleFeature(name) {
        const features = { ...(form.features || {}) };
        features[name] = !features[name];
        setForm({ ...form, features });
    }
    return (_jsxs("div", { className: "max-w-5xl mx-auto space-y-6", children: [_jsx(PageHeader, { title: "Tenant Settings", subtitle: "Customise branding, defaults, and feature flags for your medical center", icon: _jsx(SettingsIcon, { size: 20 }) }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Organisation", icon: _jsx(Building2, { size: 16 }), description: "The name shown across staff and patient portals", action: _jsxs("button", { onClick: () => saveTenant.mutate(), disabled: saveTenant.isPending, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft", children: [_jsx(Save, { size: 14 }), " ", saveTenant.isPending ? "Saving…" : saveTenant.isSuccess ? "Saved" : "Save"] }) }), _jsx(CardBody, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Name (English)", value: tenantForm.name || "", onChange: (v) => setTenantForm({ ...tenantForm, name: v }) }), _jsx(Field, { label: "Name (Arabic)", value: tenantForm.name_ar || "", onChange: (v) => setTenantForm({ ...tenantForm, name_ar: v }) })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Branding", icon: _jsx(Palette, { size: 16 }), description: "Logo, colors, and tagline shown across the apps", action: _jsx(SaveButton, { onClick: () => saveSettings.mutate(), pending: saveSettings.isPending, success: saveSettings.isSuccess }) }), _jsxs(CardBody, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Logo URL", placeholder: "https://\u2026", icon: _jsx(ImageIcon, { size: 14 }), value: form.logo_url || "", onChange: (v) => setForm({ ...form, logo_url: v }) }), _jsx(Field, { label: "Favicon URL", placeholder: "https://\u2026", value: form.favicon_url || "", onChange: (v) => setForm({ ...form, favicon_url: v }) }), _jsx(Field, { label: "Primary color", placeholder: "#14b8a6", value: form.primary_color || "", onChange: (v) => setForm({ ...form, primary_color: v }) }), _jsx(Field, { label: "Accent color", placeholder: "#0ea5e9", value: form.accent_color || "", onChange: (v) => setForm({ ...form, accent_color: v }) }), _jsx(Field, { label: "Tagline", placeholder: "Medical Appointment Platform", value: form.tagline || "", onChange: (v) => setForm({ ...form, tagline: v }), className: "md:col-span-2" })] }), (form.logo_url || form.primary_color) && (_jsxs("div", { className: "mt-4 rounded-lg border border-ink-200 p-3 flex items-center gap-3", children: [_jsx("span", { className: "text-xs text-ink-500 uppercase font-semibold tracking-wider", children: "Preview" }), form.logo_url && _jsx("img", { src: form.logo_url, alt: "logo", className: "size-10 rounded-md object-cover" }), form.primary_color && _jsx("span", { className: "inline-block size-6 rounded-full ring-1 ring-ink-200", style: { background: form.primary_color } })] }))] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Regional & booking defaults", icon: _jsx(Globe, { size: 16 }), description: "Applied when creating new clinics, schedules, and appointments", action: _jsx(SaveButton, { onClick: () => saveSettings.mutate(), pending: saveSettings.isPending, success: saveSettings.isSuccess }) }), _jsx(CardBody, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "Default timezone", placeholder: "Asia/Amman", value: form.default_timezone || "", onChange: (v) => setForm({ ...form, default_timezone: v }) }), _jsx(Field, { label: "Default language", placeholder: "en", value: form.default_language || "", onChange: (v) => setForm({ ...form, default_language: v }) }), _jsx(Field, { label: "Currency", placeholder: "JOD", value: form.currency || "", onChange: (v) => setForm({ ...form, currency: v }) }), _jsx(Field, { label: "Slot minutes", placeholder: "30", value: String(form.appointment_slot_minutes_default ?? ""), onChange: (v) => setForm({ ...form, appointment_slot_minutes_default: Number(v) || 30 }) }), _jsx(Field, { label: "Supported languages (comma)", placeholder: "en, ar", value: (form.supported_languages || []).join(", "), onChange: (v) => setForm({ ...form, supported_languages: v.split(",").map((s) => s.trim()).filter(Boolean) }), className: "md:col-span-2" })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Features", icon: _jsx(Sparkles, { size: 16 }), description: "Toggle modules per tenant", action: _jsx(SaveButton, { onClick: () => saveSettings.mutate(), pending: saveSettings.isPending, success: saveSettings.isSuccess }) }), _jsx(CardBody, { children: _jsxs("div", { className: "space-y-2", children: [_jsx(FeatureToggle, { label: "AI assistant", description: "Show the AI chat across all portals", checked: !!form.features?.ai_assistant, onChange: () => toggleFeature("ai_assistant") }), _jsx(FeatureToggle, { label: "Telemedicine", description: "Enable video appointments and remote consultations", checked: !!form.features?.telemedicine, onChange: () => toggleFeature("telemedicine") }), _jsx(FeatureToggle, { label: "Patient self-registration", description: "Allow patients to sign up themselves (otherwise secretary-only)", checked: !!form.features?.patient_self_registration, onChange: () => toggleFeature("patient_self_registration") }), _jsx(FeatureToggle, { label: "Require KYC before booking", description: "Block appointment booking until KYC documents are verified", checked: !!form.features?.require_kyc_before_booking, onChange: () => toggleFeature("require_kyc_before_booking") }), _jsx(FeatureToggle, { label: "Show branding in emails", description: "Include tenant logo and colors in notification emails", checked: !!form.features?.show_branding_in_emails, onChange: () => toggleFeature("show_branding_in_emails") })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Public contact", icon: _jsx(Phone, { size: 16 }), description: "Visible to patients in the app and outbound emails", action: _jsx(SaveButton, { onClick: () => saveSettings.mutate(), pending: saveSettings.isPending, success: saveSettings.isSuccess }) }), _jsx(CardBody, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "Support email", icon: _jsx(Mail, { size: 14 }), placeholder: "support@\u2026", value: form.support_email || "", onChange: (v) => setForm({ ...form, support_email: v }) }), _jsx(Field, { label: "Support phone", icon: _jsx(Phone, { size: 14 }), value: form.support_phone || "", onChange: (v) => setForm({ ...form, support_phone: v }) }), _jsx(Field, { label: "Website URL", placeholder: "https://\u2026", value: form.website_url || "", onChange: (v) => setForm({ ...form, website_url: v }) }), _jsx(Field, { label: "Public address", value: form.public_address || "", onChange: (v) => setForm({ ...form, public_address: v }) })] }) })] })] }));
}
// ---------------------------------------------------------------------------
function Field({ label, value, onChange, placeholder, icon, className, }) {
    return (_jsxs("div", { className: className, children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: label }), _jsxs("div", { className: "mt-1 relative", children: [icon && _jsx("span", { className: "absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400", children: icon }), _jsx("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, className: `w-full h-9 rounded-lg border border-ink-200 ${icon ? "pl-8" : "px-3"} pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300` })] })] }));
}
function FeatureToggle({ label, description, checked, onChange, }) {
    return (_jsxs("button", { onClick: onChange, className: "w-full flex items-start gap-3 p-3 rounded-lg hover:bg-ink-50 transition text-left", children: [_jsx("div", { className: `mt-0.5 w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`, children: _jsx("span", { className: "size-5 rounded-full bg-white shadow-soft" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-ink-800", children: label }), _jsx("div", { className: "text-xs text-ink-500 mt-0.5", children: description })] })] }));
}
function SaveButton({ onClick, pending, success }) {
    return (_jsxs("button", { onClick: onClick, disabled: pending, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft", children: [_jsx(Save, { size: 14 }), " ", pending ? "Saving…" : success ? "Saved" : "Save"] }));
}
