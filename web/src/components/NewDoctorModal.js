import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save, ShieldCheck, Stethoscope, X } from "lucide-react";
import { api } from "../api/client";
export function NewDoctorModal({ open, onClose, existing }) {
    const editing = !!existing;
    const qc = useQueryClient();
    const [form, setForm] = useState({
        full_name: "",
        full_name_ar: "",
        email: "",
        phone: "",
        license_number: "",
        years_of_experience: "",
        languages: "en, ar",
        consultation_fee: "",
        appointment_duration_minutes: 30,
        online_appointments: false,
        bio: "",
        specialty_ids: [],
        branch_ids: [],
    });
    const [error, setError] = useState(null);
    const [created, setCreated] = useState(null);
    useEffect(() => {
        if (existing) {
            setForm({
                full_name: existing.user?.full_name || "",
                full_name_ar: existing.user?.full_name_ar || "",
                email: existing.user?.email || "",
                phone: existing.user?.phone || "",
                license_number: existing.license_number || "",
                years_of_experience: existing.years_of_experience?.toString() || "",
                languages: (existing.languages || []).join(", "),
                consultation_fee: existing.consultation_fee?.toString() || "",
                appointment_duration_minutes: existing.appointment_duration_minutes ?? 30,
                online_appointments: !!existing.online_appointments,
                bio: existing.bio || "",
                specialty_ids: (existing.specialties || []).map((s) => s.id),
                branch_ids: existing.branch_ids || [],
            });
        }
    }, [existing]);
    const specialties = useQuery({
        queryKey: ["specialties"],
        queryFn: async () => (await api.get("/doctors/specialties")).data,
        enabled: open,
    });
    const branches = useQuery({
        queryKey: ["branches"],
        queryFn: async () => (await api.get("/branches/")).data,
        enabled: open,
    });
    const save = useMutation({
        mutationFn: async (body) => {
            if (editing)
                return (await api.patch(`/doctors/${existing.id}`, body)).data;
            return (await api.post("/doctors/", body)).data;
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["doctors"] });
            if (editing) {
                onClose();
            }
            else {
                setCreated(data);
            }
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save doctor"),
    });
    function onSubmit(e) {
        e.preventDefault();
        setError(null);
        const payload = { ...form };
        payload.languages = form.languages.split(",").map((s) => s.trim()).filter(Boolean);
        payload.years_of_experience = form.years_of_experience ? Number(form.years_of_experience) : undefined;
        payload.consultation_fee = form.consultation_fee ? Number(form.consultation_fee) : undefined;
        payload.appointment_duration_minutes = Number(form.appointment_duration_minutes) || 30;
        save.mutate(payload);
    }
    function toggleSpec(id) {
        const ids = new Set(form.specialty_ids);
        ids.has(id) ? ids.delete(id) : ids.add(id);
        setForm({ ...form, specialty_ids: Array.from(ids) });
    }
    function toggleBranch(id) {
        const ids = new Set(form.branch_ids);
        ids.has(id) ? ids.delete(id) : ids.add(id);
        setForm({ ...form, branch_ids: Array.from(ids) });
    }
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-2xl bg-white rounded-2xl shadow-lift max-h-[90vh] overflow-auto", children: [_jsxs("div", { className: "sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(Stethoscope, { size: 16 }), created ? "Doctor created" : editing ? "Edit doctor" : "Onboard a new doctor"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), created ? (_jsx(SuccessPanel, { doctor: created, onDone: () => { setCreated(null); onClose(); } })) : (_jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-5", children: [_jsx(Section, { title: "Identity", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Full name (English) *", value: form.full_name, onChange: (v) => setForm({ ...form, full_name: v }), required: true }), _jsx(Field, { label: "Full name (Arabic)", value: form.full_name_ar, onChange: (v) => setForm({ ...form, full_name_ar: v }) }), _jsx(Field, { label: "Email *", type: "email", value: form.email, onChange: (v) => setForm({ ...form, email: v }), required: true, placeholder: "dr.name@clinic.com" }), _jsx(Field, { label: "Phone", value: form.phone, onChange: (v) => setForm({ ...form, phone: v }) })] }) }), _jsx(Section, { title: "Credentials", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "License number *", value: form.license_number, onChange: (v) => setForm({ ...form, license_number: v }), required: true }), _jsx(Field, { label: "Years of experience", type: "number", value: form.years_of_experience, onChange: (v) => setForm({ ...form, years_of_experience: v }) }), _jsx(Field, { label: "Languages (comma-separated)", value: form.languages, onChange: (v) => setForm({ ...form, languages: v }), placeholder: "en, ar" }), _jsx(Field, { label: "Consultation fee", type: "number", value: form.consultation_fee, onChange: (v) => setForm({ ...form, consultation_fee: v }) }), _jsx(Field, { label: "Default appointment minutes", type: "number", value: form.appointment_duration_minutes, onChange: (v) => setForm({ ...form, appointment_duration_minutes: v }) }), _jsx(Toggle, { label: "Available for online (telemedicine) appointments", checked: form.online_appointments, onChange: (v) => setForm({ ...form, online_appointments: v }) })] }) }), _jsx(Section, { title: "Specialties", children: _jsx(ChipMultiSelect, { items: (specialties.data?.data || []).map((s) => ({ id: s.id, label: s.name })), selected: new Set(form.specialty_ids), onToggle: toggleSpec, empty: "No specialties seeded yet." }) }), _jsx(Section, { title: "Branches", children: _jsx(ChipMultiSelect, { items: (branches.data?.data || []).map((b) => ({ id: b.id, label: b.name })), selected: new Set(form.branch_ids), onToggle: toggleBranch, empty: "No branches configured." }) }), _jsx(Section, { title: "Bio", children: _jsx("textarea", { value: form.bio, onChange: (e) => setForm({ ...form, bio: e.target.value }), rows: 3, placeholder: "Short professional summary visible to patients.", className: "w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }) }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: [save.isPending ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : editing ? _jsx(Save, { size: 14 }) : _jsx(Stethoscope, { size: 14 }), save.isPending ? "Saving…" : editing ? "Save changes" : "Create doctor"] })] })] }))] }) }));
}
function SuccessPanel({ doctor, onDone }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(`Email: ${doctor.email}\nPassword: ${doctor.temporary_password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }
    return (_jsxs("div", { className: "p-5 space-y-4", children: [_jsxs("div", { className: "rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-1.5 font-semibold text-emerald-800", children: [_jsx(ShieldCheck, { size: 16 }), " ", doctor.full_name, " can now log in"] }), _jsx("p", { className: "text-emerald-700 mt-1", children: doctor.message })] }), _jsxs("div", { className: "rounded-xl border border-ink-200 p-4 space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-ink-500", children: "Email" }), _jsx("span", { className: "font-mono text-ink-800", children: doctor.email })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-ink-500", children: "Temporary password" }), _jsx("span", { className: "font-mono text-ink-800", children: doctor.temporary_password })] }), _jsxs("button", { onClick: copy, className: "mt-2 inline-flex items-center gap-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium px-3 py-1.5 rounded-md", children: [_jsx(Copy, { size: 12 }), " ", copied ? "Copied!" : "Copy credentials"] })] }), _jsx("p", { className: "text-xs text-ink-500", children: "Share this securely with the doctor. They should change the password on first login. The password will not be shown again." }), _jsx("div", { className: "flex justify-end pt-2 border-t border-ink-100", children: _jsx("button", { onClick: onDone, className: "bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-soft", children: "Done" }) })] }));
}
function Section({ title, children }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2", children: title }), children] }));
}
function Field({ label, value, onChange, placeholder, required, type, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value, type: type || "text", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
function Toggle({ label, checked, onChange }) {
    return (_jsxs("button", { type: "button", onClick: () => onChange(!checked), className: "flex items-center gap-3 text-left col-span-1 md:col-span-2", children: [_jsx("span", { className: `w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`, children: _jsx("span", { className: "size-5 rounded-full bg-white shadow-soft" }) }), _jsx("span", { className: "text-sm text-ink-700", children: label })] }));
}
function ChipMultiSelect({ items, selected, onToggle, empty, }) {
    if (items.length === 0)
        return _jsx("p", { className: "text-xs text-ink-500", children: empty });
    return (_jsx("div", { className: "flex flex-wrap gap-1.5", children: items.map((it) => {
            const on = selected.has(it.id);
            return (_jsx("button", { type: "button", onClick: () => onToggle(it.id), className: `text-xs px-2.5 py-1 rounded-full transition ring-1 ring-inset ${on
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100"}`, children: it.label }, it.id));
        }) }));
}
