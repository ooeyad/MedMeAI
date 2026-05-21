import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, UserPlus, X } from "lucide-react";
import { api } from "../api/client";
function toList(v) {
    return Array.isArray(v) ? v.join(", ") : (v || "");
}
export function NewPatientModal({ open, onClose, existing }) {
    const editing = !!existing;
    const qc = useQueryClient();
    const [form, setForm] = useState({
        full_name_en: "",
        full_name_ar: "",
        phone: "",
        email: "",
        national_id: "",
        date_of_birth: "",
        gender: "",
        city: "",
        blood_type: "",
        allergies: "",
        chronic_diseases: "",
        current_medications: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        consent_treatment: true,
    });
    useEffect(() => {
        if (existing) {
            setForm({
                full_name_en: existing.full_name_en || "",
                full_name_ar: existing.full_name_ar || "",
                phone: existing.phone || "",
                email: existing.email || "",
                national_id: existing.national_id || "",
                date_of_birth: existing.date_of_birth || "",
                gender: existing.gender || "",
                city: existing.city || "",
                blood_type: existing.blood_type || "",
                allergies: toList(existing.allergies),
                chronic_diseases: toList(existing.chronic_diseases),
                current_medications: toList(existing.current_medications),
                emergency_contact_name: existing.emergency_contact_name || "",
                emergency_contact_phone: existing.emergency_contact_phone || "",
                consent_treatment: !!existing.consent_treatment,
            });
        }
    }, [existing]);
    const [error, setError] = useState(null);
    const save = useMutation({
        mutationFn: async (body) => {
            if (editing)
                return (await api.patch(`/patients/${existing.id}`, body)).data;
            return (await api.post("/patients/", body)).data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["patients"] });
            qc.invalidateQueries({ queryKey: ["patient", existing?.id] });
            onClose();
        },
        onError: (e) => setError(e.response?.data?.error?.message || "Failed to save patient"),
    });
    function onSubmit(e) {
        e.preventDefault();
        setError(null);
        const payload = { ...form };
        for (const key of ["allergies", "chronic_diseases", "current_medications"]) {
            payload[key] = form[key]
                ? form[key].split(",").map((s) => s.trim()).filter(Boolean)
                : [];
        }
        if (!payload.date_of_birth)
            delete payload.date_of_birth;
        if (!payload.gender)
            delete payload.gender;
        save.mutate(payload);
    }
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4", children: _jsxs("div", { className: "w-full max-w-2xl bg-white rounded-2xl shadow-lift max-h-[90vh] overflow-auto", children: [_jsxs("div", { className: "sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-ink-100", children: [_jsxs("div", { className: "flex items-center gap-2 text-ink-800 font-semibold", children: [_jsx(UserPlus, { size: 16 }), " ", editing ? "Edit patient" : "New patient"] }), _jsx("button", { onClick: onClose, className: "text-ink-400 hover:text-ink-700", children: _jsx(X, { size: 16 }) })] }), _jsxs("form", { onSubmit: onSubmit, className: "p-5 space-y-5", children: [_jsx(Section, { title: "Identity", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Full name (English) *", value: form.full_name_en, onChange: (v) => setForm({ ...form, full_name_en: v }), required: true }), _jsx(Field, { label: "Full name (Arabic)", value: form.full_name_ar, onChange: (v) => setForm({ ...form, full_name_ar: v }), placeholder: "\u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629" }), _jsx(Field, { label: "Phone *", value: form.phone, onChange: (v) => setForm({ ...form, phone: v }), required: true, placeholder: "07XXXXXXXX" }), _jsx(Field, { label: "Email", type: "email", value: form.email, onChange: (v) => setForm({ ...form, email: v }) }), _jsx(Field, { label: "National ID", value: form.national_id, onChange: (v) => setForm({ ...form, national_id: v }) }), _jsx(Field, { label: "Date of birth", type: "date", value: form.date_of_birth, onChange: (v) => setForm({ ...form, date_of_birth: v }) }), _jsx(Select, { label: "Gender", value: form.gender, onChange: (v) => setForm({ ...form, gender: v }), options: [{ value: "", label: "—" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }] }), _jsx(Field, { label: "City", value: form.city, onChange: (v) => setForm({ ...form, city: v }) })] }) }), _jsx(Section, { title: "Medical", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Blood type", value: form.blood_type, onChange: (v) => setForm({ ...form, blood_type: v }), placeholder: "O+" }), _jsx(Field, { label: "Allergies (comma-separated)", value: form.allergies, onChange: (v) => setForm({ ...form, allergies: v }), placeholder: "penicillin, peanuts" }), _jsx(Field, { label: "Chronic conditions", value: form.chronic_diseases, onChange: (v) => setForm({ ...form, chronic_diseases: v }), placeholder: "hypertension, asthma" }), _jsx(Field, { label: "Current medications", value: form.current_medications, onChange: (v) => setForm({ ...form, current_medications: v }), placeholder: "lisinopril 10mg" })] }) }), _jsx(Section, { title: "Emergency contact", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: [_jsx(Field, { label: "Name", value: form.emergency_contact_name, onChange: (v) => setForm({ ...form, emergency_contact_name: v }) }), _jsx(Field, { label: "Phone", value: form.emergency_contact_phone, onChange: (v) => setForm({ ...form, emergency_contact_phone: v }) })] }) }), error && _jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-ink-100", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-3 py-2 text-sm text-ink-600 hover:text-ink-800", children: "Cancel" }), _jsxs("button", { type: "submit", disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft", children: [save.isPending ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : editing ? _jsx(Save, { size: 14 }) : _jsx(UserPlus, { size: 14 }), save.isPending ? "Saving…" : editing ? "Save changes" : "Create patient"] })] })] })] }) }));
}
function Section({ title, children }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2", children: title }), children] }));
}
function Field({ label, value, onChange, placeholder, required, type, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("input", { value: value, type: type || "text", onChange: (e) => onChange(e.target.value), placeholder: placeholder, required: required, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
function Select({ label, value, onChange, options, }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-medium text-ink-700", children: label }), _jsx("select", { value: value, onChange: (e) => onChange(e.target.value), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: options.map((o) => _jsx("option", { value: o.value, children: o.label }, o.value)) })] }));
}
