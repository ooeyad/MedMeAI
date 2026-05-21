import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertCircle, ArrowLeft, Beaker, CheckCircle2, ClipboardList, Droplet, FlaskConical, HeartPulse, NotebookPen, Phone, Pill, Plus, Save, Thermometer, User, } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
const TABS = [
    { key: "overview", label: "Overview", icon: _jsx(ClipboardList, { size: 14 }) },
    { key: "notes", label: "Diagnosis & notes", icon: _jsx(NotebookPen, { size: 14 }) },
    { key: "prescriptions", label: "Prescriptions", icon: _jsx(Pill, { size: 14 }) },
    { key: "labs", label: "Lab tests", icon: _jsx(FlaskConical, { size: 14 }) },
    { key: "imaging", label: "Imaging & procedures", icon: _jsx(Beaker, { size: 14 }) },
    { key: "vitals", label: "Vitals", icon: _jsx(Activity, { size: 14 }) },
];
// Quick-pick lists are now data-driven via /billing/items.
// Hooks below fetch them from the catalog the admin manages in /price-list.
function useCatalogPicks(kind) {
    return useQuery({
        queryKey: ["catalog-picks", kind],
        queryFn: async () => (await api.get("/billing/items", { params: { kind, page_size: 50 } })).data,
    });
}
// Medications and procedures are also catalog-driven (kind = medication / procedure).
// Suggested medication form-defaults still need dosage/frequency hints,
// which we derive from the item's `description` field when present.
function useCatalogMeds() {
    return useQuery({
        queryKey: ["catalog-picks", "medication"],
        queryFn: async () => (await api.get("/billing/items", { params: { kind: "medication", page_size: 50 } })).data,
    });
}
export function ConsultationPage() {
    const { appointmentId } = useParams();
    const id = Number(appointmentId);
    const [tab, setTab] = useState("overview");
    const navigate = useNavigate();
    const qc = useQueryClient();
    const appt = useQuery({
        queryKey: ["appointment", id],
        queryFn: async () => (await api.get(`/appointments/${id}`)).data,
        enabled: !!id,
    });
    const patientId = appt.data?.patient_id;
    const patient = useQuery({
        queryKey: ["patient", patientId],
        queryFn: async () => (await api.get(`/patients/${patientId}`)).data,
        enabled: !!patientId,
    });
    const note = useQuery({
        queryKey: ["consult-note", id],
        queryFn: async () => (await api.get(`/clinical/appointments/${id}/note`)).data,
        enabled: !!id,
    });
    const rx = useQuery({
        queryKey: ["consult-rx", id],
        queryFn: async () => (await api.get(`/clinical/appointments/${id}/prescriptions`)).data,
        enabled: !!id,
    });
    const labs = useQuery({
        queryKey: ["consult-labs", id],
        queryFn: async () => (await api.get(`/clinical/appointments/${id}/lab-orders`)).data,
        enabled: !!id,
    });
    const vitals = useQuery({
        queryKey: ["consult-vitals", id],
        queryFn: async () => (await api.get(`/clinical/appointments/${id}/vitals`)).data,
        enabled: !!id,
    });
    const transition = useMutation({
        mutationFn: async (action) => api.post(`/appointments/${id}/${action}`, {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["appointment", id] }),
    });
    async function startConsult() {
        await transition.mutateAsync("start");
    }
    async function completeConsult() {
        await transition.mutateAsync("complete");
        // Take the doctor straight to the freshly auto-generated invoice
        try {
            const res = await api.get(`/billing/invoices`, {
                params: { patient_id: patient.data?.id, page_size: 1 },
            });
            const created = res.data?.data?.[0];
            if (created?.appointment_id === id) {
                navigate(`/invoices/${created.id}`);
                return;
            }
        }
        catch (_) { /* ignore */ }
        navigate("/");
    }
    const status = appt.data?.status;
    const inConsult = status === "in_consultation";
    const completed = status === "completed";
    const apptError = appt.error?.response?.data?.error?.message || appt.error?.message;
    const patientError = patient.error?.response?.data?.error?.message || patient.error?.message;
    return (_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 mb-3", children: [_jsx(ArrowLeft, { size: 12 }), " Back to queue"] }), (apptError || patientError) && (_jsxs("div", { className: "mb-4 rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm px-3 py-2", children: [apptError && _jsxs("div", { children: ["Appointment: ", apptError] }), patientError && _jsxs("div", { children: ["Patient: ", patientError] }), _jsx("div", { className: "text-xs text-rose-600 mt-1", children: "Common causes: you're scoped to a different tenant in the header dropdown, or the patient was moved to another tenant. Try setting the tenant scope to \"All tenants\" (super admin) or the appointment's home tenant." })] })), _jsx(Card, { className: "mb-5", children: _jsxs(CardBody, { children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-start gap-4 min-w-0", children: [_jsx(Avatar, { name: patient.data?.full_name_en, size: "xl", ring: true }), _jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-xl font-semibold text-ink-900 truncate", children: patient.data?.full_name_en || "Loading…" }), _jsxs("div", { className: "text-sm text-ink-500", children: [patient.data?.code, " \u00B7 ", appt.data?.code] }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-600", children: [patient.data?.date_of_birth && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(User, { size: 12 }), " Born ", patient.data.date_of_birth] })), patient.data?.phone && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Phone, { size: 12 }), " ", patient.data.phone] })), patient.data?.blood_type && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Droplet, { size: 12 }), " ", patient.data.blood_type] })), _jsx(Badge, { tone: statusTone(status || ""), dot: true, pulse: inConsult, children: (status || "—").replaceAll("_", " ") })] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [status === "checked_in" && (_jsxs("button", { onClick: startConsult, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-4 py-2 shadow-soft font-medium", children: [_jsx(Activity, { size: 14 }), " Start consultation"] })), inConsult && (_jsxs("button", { onClick: completeConsult, className: "inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-4 py-2 shadow-soft font-medium", children: [_jsx(CheckCircle2, { size: 14 }), " Complete consultation"] }))] })] }), (patient.data?.allergies?.length || patient.data?.chronic_diseases?.length) && (_jsxs("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-2 gap-2", children: [patient.data.allergies?.length > 0 && (_jsx(Alert, { icon: _jsx(AlertCircle, { size: 14 }), tone: "rose", label: "Allergies", items: patient.data.allergies })), patient.data.chronic_diseases?.length > 0 && (_jsx(Alert, { icon: _jsx(HeartPulse, { size: 14 }), tone: "amber", label: "Chronic conditions", items: patient.data.chronic_diseases }))] }))] }) }), _jsx("div", { className: "mb-4 border-b border-ink-200 flex items-center gap-1 overflow-x-auto", children: TABS.map((t) => (_jsxs("button", { onClick: () => setTab(t.key), className: clsx("inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px", tab === t.key
                        ? "border-brand-600 text-brand-700"
                        : "border-transparent text-ink-500 hover:text-ink-800"), children: [t.icon, t.label] }, t.key))) }), tab === "overview" && (_jsx(OverviewTab, { patient: patient.data, appt: appt.data, note: note.data, rxs: rx.data?.data || [], labs: labs.data?.data || [], vitals: vitals.data })), tab === "notes" && _jsx(NotesTab, { appointmentId: id, initial: note.data, readonly: completed }), tab === "prescriptions" && _jsx(PrescriptionsTab, { appointmentId: id, items: rx.data?.data || [], readonly: completed }), tab === "labs" && (_jsx(OrderTab, { appointmentId: id, items: (labs.data?.data || []).filter((o) => (o.kind || "lab") === "lab"), readonly: completed, kind: "lab", title: "Laboratory tests", subtitle: "Order tests and record results as they come back", icon: _jsx(FlaskConical, { size: 16 }), accent: "violet", suggestionKind: "lab_test" })), tab === "imaging" && (_jsx(OrderTab, { appointmentId: id, items: (labs.data?.data || []).filter((o) => o.kind === "imaging" || o.kind === "procedure" || o.kind === "referral"), readonly: completed, kind: "imaging", title: "Imaging & procedures", subtitle: "X-ray, ultrasound, ECG, biopsies, referrals", icon: _jsx(Beaker, { size: 16 }), accent: "sky", suggestionKind: "imaging", extraSuggestionKind: "procedure", allowKindSelect: true })), tab === "vitals" && _jsx(VitalsTab, { appointmentId: id, initial: vitals.data, readonly: completed })] }));
}
// ===========================================================================
// Tabs
// ===========================================================================
function OverviewTab({ patient, appt, note, rxs, labs, vitals }) {
    return (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-5", children: [_jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { title: "Reason for visit", icon: _jsx(ClipboardList, { size: 16 }) }), _jsx(CardBody, { children: _jsxs("div", { className: "text-sm", children: [_jsx("div", { className: "text-ink-500", children: "Chief complaint" }), _jsx("div", { className: "font-medium text-ink-800 mt-0.5", children: appt?.reason || "Not stated" }), appt?.symptoms && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-ink-500 mt-3", children: "Symptoms" }), _jsx("div", { className: "text-ink-700 mt-0.5", children: appt.symptoms })] })), note?.diagnosis && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-ink-500 mt-3", children: "Working diagnosis" }), _jsx("div", { className: "text-ink-700 mt-0.5", children: note.diagnosis })] })), note?.treatment_plan && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-ink-500 mt-3", children: "Plan" }), _jsx("div", { className: "text-ink-700 mt-0.5", children: note.treatment_plan })] }))] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Medications & allergies", icon: _jsx(Pill, { size: 16 }) }), _jsx(CardBody, { children: _jsxs("div", { className: "space-y-3 text-sm", children: [_jsx(Field, { label: "Allergies", items: patient?.allergies || [], tone: "bg-rose-50 text-rose-700 ring-rose-200" }), _jsx(Field, { label: "Chronic", items: patient?.chronic_diseases || [], tone: "bg-amber-50 text-amber-700 ring-amber-200" }), _jsx(Field, { label: "Current meds", items: patient?.current_medications || [], tone: "bg-brand-50 text-brand-700 ring-brand-200" })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Latest vitals", icon: _jsx(Activity, { size: 16 }), description: vitals?.recorded_at ? `Recorded ${vitals.recorded_at.slice(0, 16).replace("T", " ")}` : "Not captured yet" }), _jsx(CardBody, { children: vitals && (vitals.weight_kg || vitals.heart_rate_bpm) ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsx(Stat, { icon: _jsx(Thermometer, { size: 12 }), label: "Temp", value: vitals.temperature_c ? `${vitals.temperature_c}°C` : "—" }), _jsx(Stat, { icon: _jsx(HeartPulse, { size: 12 }), label: "HR", value: vitals.heart_rate_bpm ? `${vitals.heart_rate_bpm} bpm` : "—" }), _jsx(Stat, { icon: _jsx(Activity, { size: 12 }), label: "BP", value: vitals.blood_pressure_systolic ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : "—" }), _jsx(Stat, { icon: _jsx(Droplet, { size: 12 }), label: "SpO2", value: vitals.oxygen_saturation ? `${vitals.oxygen_saturation}%` : "—" })] })) : (_jsx("p", { className: "text-sm text-ink-500", children: "No vitals captured for this visit." })) })] }), _jsxs(Card, { className: "lg:col-span-2", children: [_jsx(CardHeader, { title: "This visit", icon: _jsx(Pill, { size: 16 }), description: `${rxs.length} prescription${rxs.length === 1 ? "" : "s"} · ${labs.length} lab order${labs.length === 1 ? "" : "s"}` }), _jsx(CardBody, { children: rxs.length === 0 && labs.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500", children: "Nothing prescribed or ordered yet." })) : (_jsxs("div", { className: "space-y-3", children: [rxs.slice(0, 3).map((r) => (_jsxs("div", { className: "text-sm flex items-center gap-2", children: [_jsx(Pill, { size: 12, className: "text-brand-500" }), _jsx("span", { className: "font-medium text-ink-800", children: r.medication }), _jsxs("span", { className: "text-ink-500", children: [r.dosage, " ", r.frequency ? `· ${r.frequency}` : ""] }), _jsx(Badge, { tone: statusTone(r.status), className: "ml-auto", children: r.status })] }, r.id))), labs.slice(0, 3).map((l) => (_jsxs("div", { className: "text-sm flex items-center gap-2", children: [_jsx(FlaskConical, { size: 12, className: "text-violet-500" }), _jsx("span", { className: "font-medium text-ink-800", children: l.test_name }), _jsxs("span", { className: "text-ink-500", children: ["\u00B7 ", l.priority] }), _jsx(Badge, { tone: statusTone(l.status), className: "ml-auto", children: l.status.replaceAll("_", " ") })] }, l.id)))] })) })] })] }));
}
function NotesTab({ appointmentId, initial, readonly }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        chief_complaint: "",
        history_of_present_illness: "",
        examination: "",
        diagnosis: "",
        icd10_codes: "",
        treatment_plan: "",
        follow_up_in_days: "",
        private_notes: "",
    });
    useEffect(() => {
        if (initial) {
            setForm({
                chief_complaint: initial.chief_complaint || "",
                history_of_present_illness: initial.history_of_present_illness || "",
                examination: initial.examination || "",
                diagnosis: initial.diagnosis || "",
                icd10_codes: initial.icd10_codes || "",
                treatment_plan: initial.treatment_plan || "",
                follow_up_in_days: initial.follow_up_in_days?.toString() || "",
                private_notes: initial.private_notes || "",
            });
        }
    }, [initial]);
    const save = useMutation({
        mutationFn: async () => api.put(`/clinical/appointments/${appointmentId}/note`, {
            ...form,
            follow_up_in_days: form.follow_up_in_days ? Number(form.follow_up_in_days) : null,
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["consult-note", appointmentId] }),
    });
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Clinical notes", icon: _jsx(NotebookPen, { size: 16 }), action: !readonly && (_jsxs("button", { onClick: () => save.mutate(), disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft", children: [_jsx(Save, { size: 14 }), " ", save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save notes"] })) }), _jsx(CardBody, { children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Textarea, { label: "Chief complaint", value: form.chief_complaint, onChange: (v) => setForm({ ...form, chief_complaint: v }), readonly: readonly }), _jsx(Textarea, { label: "History of present illness", value: form.history_of_present_illness, onChange: (v) => setForm({ ...form, history_of_present_illness: v }), readonly: readonly }), _jsx(Textarea, { label: "Examination findings", value: form.examination, onChange: (v) => setForm({ ...form, examination: v }), readonly: readonly }), _jsx(Textarea, { label: "Diagnosis", value: form.diagnosis, onChange: (v) => setForm({ ...form, diagnosis: v }), readonly: readonly }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "ICD-10 codes" }), _jsx("input", { value: form.icd10_codes, onChange: (e) => setForm({ ...form, icd10_codes: e.target.value }), readOnly: readonly, placeholder: "e.g. I10, E11.9", className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Follow-up (days)" }), _jsx("input", { type: "number", value: form.follow_up_in_days, onChange: (e) => setForm({ ...form, follow_up_in_days: e.target.value }), readOnly: readonly, placeholder: "14", className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }), _jsx(Textarea, { label: "Treatment plan", value: form.treatment_plan, onChange: (v) => setForm({ ...form, treatment_plan: v }), readonly: readonly, className: "md:col-span-2" }), _jsx(Textarea, { label: "Private notes (not shown to patient)", value: form.private_notes, onChange: (v) => setForm({ ...form, private_notes: v }), readonly: readonly, className: "md:col-span-2" })] }) })] }));
}
function PrescriptionsTab({ appointmentId, items, readonly }) {
    const qc = useQueryClient();
    const medsQ = useCatalogMeds();
    const meds = (medsQ.data?.data || []);
    const [form, setForm] = useState({ medication: "", dosage: "", frequency: "", duration_days: "", quantity: "", instructions: "" });
    const [error, setError] = useState(null);
    const add = useMutation({
        mutationFn: async () => api.post(`/clinical/appointments/${appointmentId}/prescriptions`, {
            ...form,
            duration_days: form.duration_days ? Number(form.duration_days) : null,
            quantity: form.quantity ? Number(form.quantity) : null,
        }),
        onSuccess: () => {
            setForm({ medication: "", dosage: "", frequency: "", duration_days: "", quantity: "", instructions: "" });
            setError(null);
            qc.invalidateQueries({ queryKey: ["consult-rx", appointmentId] });
        },
        onError: (e) => setError(e.response?.data?.error?.message || e.message || "Couldn't save prescription"),
    });
    return (_jsxs("div", { className: "space-y-5", children: [!readonly && (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Add prescription", icon: _jsx(Pill, { size: 16 }), description: "Quick-pick from the catalog or fill the form manually" }), _jsxs(CardBody, { children: [_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "text-xs uppercase tracking-wider font-semibold text-ink-500 mb-2 flex items-center gap-2", children: ["Quick pick", _jsx(Link, { to: "/price-list", className: "text-[10px] text-brand-700 hover:text-brand-900 font-normal normal-case", children: "Manage catalog \u2192" })] }), medsQ.isLoading ? (_jsx("div", { className: "text-xs text-ink-400", children: "Loading catalog\u2026" })) : meds.length === 0 ? (_jsxs("div", { className: "text-xs text-ink-500", children: ["No medications in the catalog yet. ", _jsx(Link, { to: "/price-list", className: "text-brand-700 underline", children: "Add some" }), "."] })) : (_jsx("div", { className: "flex flex-wrap gap-1.5", children: meds.map((m) => (_jsx("button", { onClick: () => setForm({
                                                medication: m.name,
                                                dosage: m.description || "",
                                                frequency: form.frequency,
                                                duration_days: form.duration_days,
                                                quantity: "",
                                                instructions: form.instructions,
                                            }), className: "text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 transition", title: m.sku ? `SKU: ${m.sku}` : undefined, children: m.name }, m.id))) }))] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm", children: [_jsx(Field2, { label: "Medication", required: true, value: form.medication, onChange: (v) => setForm({ ...form, medication: v }) }), _jsx(Field2, { label: "Dosage", placeholder: "500 mg", value: form.dosage, onChange: (v) => setForm({ ...form, dosage: v }) }), _jsx(Field2, { label: "Frequency", placeholder: "twice daily", value: form.frequency, onChange: (v) => setForm({ ...form, frequency: v }) }), _jsx(Field2, { label: "Duration (days)", value: form.duration_days, onChange: (v) => setForm({ ...form, duration_days: v }) }), _jsx(Field2, { label: "Quantity", value: form.quantity, onChange: (v) => setForm({ ...form, quantity: v }) }), _jsx(Field2, { label: "Instructions", placeholder: "after meals", value: form.instructions, onChange: (v) => setForm({ ...form, instructions: v }) })] }), error && (_jsx("div", { className: "mt-3 text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error })), _jsx("div", { className: "mt-4", children: _jsxs("button", { onClick: () => form.medication && add.mutate(), disabled: !form.medication || add.isPending, className: "inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft", children: [_jsx(Plus, { size: 14 }), " ", add.isPending ? "Adding…" : "Add to prescription list"] }) })] })] })), _jsxs(Card, { children: [_jsx(CardHeader, { title: "Prescriptions on this visit", icon: _jsx(Pill, { size: 16 }), description: `${items.length} item${items.length === 1 ? "" : "s"}` }), _jsx(CardBody, { children: items.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500", children: "No prescriptions yet." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((r) => (_jsxs("li", { className: "py-3 flex items-center gap-3 text-sm", children: [_jsx("div", { className: "size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center", children: _jsx(Pill, { size: 14 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "font-medium text-ink-800", children: [r.medication, " ", r.dosage] }), _jsxs("div", { className: "text-xs text-ink-500", children: [r.frequency || "—", " \u00B7 ", r.duration_days ? `${r.duration_days} days` : "no duration", " \u00B7 qty ", r.quantity ?? "—"] }), r.instructions && _jsx("div", { className: "text-xs text-ink-500 italic mt-0.5", children: r.instructions })] }), _jsx(Badge, { tone: statusTone(r.status), children: r.status.replaceAll("_", " ") })] }, r.id))) })) })] })] }));
}
function OrderTab({ appointmentId, items, readonly, kind, title, subtitle, icon, accent, suggestionKind, extraSuggestionKind, allowKindSelect, }) {
    const suggestionsQ = useCatalogPicks(suggestionKind);
    const extraSuggestionsQ = useQuery({
        queryKey: ["catalog-picks", extraSuggestionKind || "_none"],
        queryFn: async () => (await api.get("/billing/items", { params: { kind: extraSuggestionKind, page_size: 50 } })).data,
        enabled: !!extraSuggestionKind,
    });
    const suggestions = (suggestionsQ.data?.data || []);
    const extraSuggestions = (extraSuggestionsQ.data?.data || []);
    const qc = useQueryClient();
    const [form, setForm] = useState({ test_name: "", test_code: "", priority: "routine", clinical_notes: "", kind });
    const add = useMutation({
        mutationFn: async () => api.post(`/clinical/appointments/${appointmentId}/lab-orders`, form),
        onSuccess: () => {
            setForm({ test_name: "", test_code: "", priority: "routine", clinical_notes: "", kind });
            qc.invalidateQueries({ queryKey: ["consult-labs", appointmentId] });
        },
    });
    const accentBtn = accent === "violet" ? "bg-violet-600 hover:bg-violet-700" : "bg-sky-600 hover:bg-sky-700";
    const accentChip = accent === "violet" ? "bg-violet-50 text-violet-700 hover:bg-violet-100" : "bg-sky-50 text-sky-700 hover:bg-sky-100";
    return (_jsxs("div", { className: "space-y-5", children: [!readonly && (_jsxs(Card, { children: [_jsx(CardHeader, { title: title, icon: icon, description: subtitle }), _jsxs(CardBody, { children: [_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "text-xs uppercase tracking-wider font-semibold text-ink-500 mb-2 flex items-center gap-2", children: ["Quick pick", _jsx(Link, { to: "/price-list", className: "text-[10px] text-brand-700 hover:text-brand-900 font-normal normal-case", children: "Manage catalog \u2192" })] }), suggestionsQ.isLoading ? (_jsx("div", { className: "text-xs text-ink-400", children: "Loading catalog\u2026" })) : suggestions.length === 0 && extraSuggestions.length === 0 ? (_jsxs("div", { className: "text-xs text-ink-500", children: ["No items in the catalog yet. ", _jsx(Link, { to: "/price-list", className: "text-brand-700 underline", children: "Add some" }), "."] })) : (_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [suggestions.map((it) => (_jsx("button", { onClick: () => setForm({ ...form, test_name: it.name, test_code: it.sku, kind: kind === "imaging" ? "imaging" : "lab" }), className: `text-xs px-2.5 py-1 rounded-full transition ${accentChip}`, title: it.sku, children: it.name }, `s-${it.id}`))), extraSuggestions.map((it) => (_jsx("button", { onClick: () => setForm({ ...form, test_name: it.name, test_code: it.sku, kind: "procedure" }), className: "text-xs px-2.5 py-1 rounded-full transition bg-emerald-50 text-emerald-700 hover:bg-emerald-100", title: it.sku, children: it.name }, `x-${it.id}`)))] }))] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 text-sm", children: [_jsx(Field2, { label: kind === "imaging" ? "Procedure or imaging study" : "Test name", required: true, placeholder: kind === "imaging" ? "e.g. Chest X-ray" : "e.g. CBC", value: form.test_name, onChange: (v) => setForm({ ...form, test_name: v }) }), _jsx(Field2, { label: kind === "imaging" ? "Code (CPT/LOINC)" : "Code (LOINC)", placeholder: "optional", value: form.test_code, onChange: (v) => setForm({ ...form, test_code: v }) }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Priority" }), _jsxs("select", { value: form.priority, onChange: (e) => setForm({ ...form, priority: e.target.value }), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: [_jsx("option", { value: "routine", children: "Routine" }), _jsx("option", { value: "urgent", children: "Urgent" }), _jsx("option", { value: "stat", children: "STAT" })] })] }), allowKindSelect && (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Type" }), _jsxs("select", { value: form.kind, onChange: (e) => setForm({ ...form, kind: e.target.value }), className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white", children: [_jsx("option", { value: "imaging", children: "Imaging" }), _jsx("option", { value: "procedure", children: "Procedure" }), _jsx("option", { value: "referral", children: "Referral" })] })] })), _jsx(Field2, { label: "Clinical notes / indication", placeholder: "rule out pneumonia", value: form.clinical_notes, onChange: (v) => setForm({ ...form, clinical_notes: v }) })] }), _jsx("div", { className: "mt-4", children: _jsxs("button", { onClick: () => form.test_name && add.mutate(), disabled: !form.test_name || add.isPending, className: `inline-flex items-center gap-1.5 ${accentBtn} text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft`, children: [_jsx(Plus, { size: 14 }), " ", add.isPending ? "Ordering…" : kind === "imaging" ? "Order procedure" : "Send to lab"] }) })] })] })), _jsxs(Card, { children: [_jsx(CardHeader, { title: `${title} for this visit`, icon: icon, description: `${items.length} order${items.length === 1 ? "" : "s"}` }), _jsx(CardBody, { children: items.length === 0 ? (_jsx("p", { className: "text-sm text-ink-500", children: "Nothing ordered yet." })) : (_jsx("ul", { className: "divide-y divide-ink-100", children: items.map((l) => (_jsx(OrderRow, { order: l, readonly: readonly, appointmentId: appointmentId }, l.id))) })) })] })] }));
}
function OrderRow({ order, readonly, appointmentId }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [results, setResults] = useState(order.results || "");
    const [status, setStatus] = useState(order.status);
    const save = useMutation({
        mutationFn: async () => api.patch(`/clinical/lab-orders/${order.id}`, { status, results }),
        onSuccess: () => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["consult-labs", appointmentId] });
        },
    });
    const kindIcon = order.kind === "imaging" ? _jsx(Beaker, { size: 14 }) :
        order.kind === "procedure" ? _jsx(Activity, { size: 14 }) :
            order.kind === "referral" ? _jsx(ArrowLeft, { size: 14, className: "rotate-180" }) :
                _jsx(FlaskConical, { size: 14 });
    const accent = order.kind === "imaging" ? "bg-sky-50 text-sky-600" :
        order.kind === "procedure" ? "bg-emerald-50 text-emerald-600" :
            "bg-violet-50 text-violet-600";
    return (_jsx("li", { className: "py-3", children: _jsxs("div", { className: "flex items-start gap-3 text-sm", children: [_jsx("div", { className: `size-9 rounded-lg ${accent} grid place-items-center`, children: kindIcon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 flex-wrap", children: [_jsxs("div", { className: "font-medium text-ink-800", children: [order.test_name, order.test_code ? ` (${order.test_code})` : ""] }), _jsx(Badge, { tone: statusTone(order.status), children: order.status.replaceAll("_", " ") })] }), _jsxs("div", { className: "text-xs text-ink-500 mt-0.5", children: ["priority: ", _jsx("span", { className: "font-medium", children: order.priority }), order.clinical_notes ? ` · ${order.clinical_notes}` : ""] }), !editing && order.results && (_jsxs("div", { className: "mt-2 rounded-md bg-emerald-50 ring-1 ring-emerald-200 p-2 text-emerald-800 text-xs whitespace-pre-wrap", children: [_jsx("div", { className: "font-semibold mb-0.5", children: "Results" }), order.results] })), editing && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsx("textarea", { value: results, onChange: (e) => setResults(e.target.value), rows: 4, placeholder: "Enter results / findings\u2026", className: "w-full rounded-md border border-ink-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("select", { value: status, onChange: (e) => setStatus(e.target.value), className: "h-8 rounded-md border border-ink-200 px-2 text-xs", children: [_jsx("option", { value: "ordered", children: "Ordered" }), _jsx("option", { value: "sample_collected", children: "Sample collected" }), _jsx("option", { value: "in_progress", children: "In progress" }), _jsx("option", { value: "results_ready", children: "Results ready" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "cancelled", children: "Cancelled" })] }), _jsxs("button", { onClick: () => save.mutate(), disabled: save.isPending, className: "inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50", children: [_jsx(Save, { size: 12 }), " ", save.isPending ? "Saving…" : "Save"] }), _jsx("button", { onClick: () => { setEditing(false); setResults(order.results || ""); setStatus(order.status); }, className: "text-xs text-ink-500 hover:text-ink-800", children: "Cancel" })] })] })), !editing && !readonly && (_jsx("div", { className: "mt-2", children: _jsxs("button", { onClick: () => setEditing(true), className: "inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900", children: [_jsx(NotebookPen, { size: 12 }), " ", order.results ? "Edit results" : "Enter results / update status"] }) }))] })] }) }));
}
function VitalsTab({ appointmentId, initial, readonly }) {
    const qc = useQueryClient();
    const [form, setForm] = useState({
        weight_kg: "", height_cm: "",
        blood_pressure_systolic: "", blood_pressure_diastolic: "",
        heart_rate_bpm: "", temperature_c: "",
        respiratory_rate: "", oxygen_saturation: "", notes: "",
    });
    useEffect(() => {
        if (initial && initial.recorded_at) {
            setForm({
                weight_kg: initial.weight_kg?.toString() || "",
                height_cm: initial.height_cm?.toString() || "",
                blood_pressure_systolic: initial.blood_pressure_systolic?.toString() || "",
                blood_pressure_diastolic: initial.blood_pressure_diastolic?.toString() || "",
                heart_rate_bpm: initial.heart_rate_bpm?.toString() || "",
                temperature_c: initial.temperature_c?.toString() || "",
                respiratory_rate: initial.respiratory_rate?.toString() || "",
                oxygen_saturation: initial.oxygen_saturation?.toString() || "",
                notes: initial.notes || "",
            });
        }
    }, [initial]);
    const save = useMutation({
        mutationFn: async () => api.post(`/clinical/appointments/${appointmentId}/vitals`, {
            weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
            height_cm: form.height_cm ? Number(form.height_cm) : null,
            blood_pressure_systolic: form.blood_pressure_systolic ? Number(form.blood_pressure_systolic) : null,
            blood_pressure_diastolic: form.blood_pressure_diastolic ? Number(form.blood_pressure_diastolic) : null,
            heart_rate_bpm: form.heart_rate_bpm ? Number(form.heart_rate_bpm) : null,
            temperature_c: form.temperature_c ? Number(form.temperature_c) : null,
            respiratory_rate: form.respiratory_rate ? Number(form.respiratory_rate) : null,
            oxygen_saturation: form.oxygen_saturation ? Number(form.oxygen_saturation) : null,
            notes: form.notes,
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["consult-vitals", appointmentId] }),
    });
    return (_jsxs(Card, { children: [_jsx(CardHeader, { title: "Vitals", icon: _jsx(Activity, { size: 16 }), action: !readonly && (_jsxs("button", { onClick: () => save.mutate(), disabled: save.isPending, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft", children: [_jsx(Save, { size: 14 }), " ", save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save vitals"] })) }), _jsxs(CardBody, { children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 text-sm", children: [_jsx(Field2, { label: "Weight (kg)", value: form.weight_kg, onChange: (v) => setForm({ ...form, weight_kg: v }) }), _jsx(Field2, { label: "Height (cm)", value: form.height_cm, onChange: (v) => setForm({ ...form, height_cm: v }) }), _jsx(Field2, { label: "BP systolic", value: form.blood_pressure_systolic, onChange: (v) => setForm({ ...form, blood_pressure_systolic: v }) }), _jsx(Field2, { label: "BP diastolic", value: form.blood_pressure_diastolic, onChange: (v) => setForm({ ...form, blood_pressure_diastolic: v }) }), _jsx(Field2, { label: "Heart rate (bpm)", value: form.heart_rate_bpm, onChange: (v) => setForm({ ...form, heart_rate_bpm: v }) }), _jsx(Field2, { label: "Temperature (\u00B0C)", value: form.temperature_c, onChange: (v) => setForm({ ...form, temperature_c: v }) }), _jsx(Field2, { label: "Resp. rate", value: form.respiratory_rate, onChange: (v) => setForm({ ...form, respiratory_rate: v }) }), _jsx(Field2, { label: "SpO2 (%)", value: form.oxygen_saturation, onChange: (v) => setForm({ ...form, oxygen_saturation: v }) })] }), _jsx(Textarea, { label: "Notes", value: form.notes, onChange: (v) => setForm({ ...form, notes: v }), readonly: readonly, className: "mt-4" })] })] }));
}
// ===========================================================================
// Tiny helpers
// ===========================================================================
function Textarea({ label, value, onChange, readonly, className, }) {
    return (_jsxs("div", { className: className, children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: label }), _jsx("textarea", { value: value, onChange: (e) => onChange(e.target.value), readOnly: readonly, rows: 3, className: "mt-1 w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
function Field2({ label, value, onChange, placeholder, required, }) {
    return (_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: [label, required && _jsx("span", { className: "text-rose-500", children: "*" })] }), _jsx("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, className: "mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" })] }));
}
function Field({ label, items, tone }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold text-ink-700 mb-1", children: label }), items.length > 0 ? (_jsx("div", { className: "flex flex-wrap gap-1", children: items.map((item) => (_jsx("span", { className: `text-xs px-2 py-0.5 rounded-full ring-1 ring-inset ${tone}`, children: item }, item))) })) : (_jsx("div", { className: "text-xs text-ink-400", children: "None" }))] }));
}
function Alert({ icon, tone, label, items }) {
    const cls = tone === "rose" ? "bg-rose-50 ring-rose-200 text-rose-700" : "bg-amber-50 ring-amber-200 text-amber-700";
    return (_jsxs("div", { className: `rounded-lg ring-1 ring-inset p-3 ${cls}`, children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs font-semibold mb-1", children: [icon, " ", label] }), _jsx("div", { className: "text-sm font-medium", children: items.join(", ") })] }));
}
function Stat({ icon, label, value }) {
    return (_jsxs("div", { className: "rounded-lg bg-ink-50 px-3 py-2", children: [_jsxs("div", { className: "text-[11px] text-ink-500 flex items-center gap-1", children: [icon, label] }), _jsx("div", { className: "font-semibold text-ink-800 text-sm", children: value })] }));
}
