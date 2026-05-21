import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, Calendar, CheckCircle2, Clock, MessageSquare, Stethoscope, User, } from "lucide-react";
import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";
const FULL_STEPS = [
    { key: "patient", title: "Patient", icon: _jsx(User, { size: 14 }) },
    { key: "branch", title: "Branch", icon: _jsx(Building2, { size: 14 }) },
    { key: "doctor", title: "Doctor", icon: _jsx(Stethoscope, { size: 14 }) },
    { key: "slot", title: "Slot", icon: _jsx(Clock, { size: 14 }) },
    { key: "reason", title: "Reason", icon: _jsx(MessageSquare, { size: 14 }) },
    { key: "confirm", title: "Confirm", icon: _jsx(CheckCircle2, { size: 14 }) },
];
export function BookAppointmentPage() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isPatient = (user?.roles || []).includes("patient");
    // Patients book for themselves — skip the patient picker entirely.
    const STEPS = isPatient ? FULL_STEPS.filter((s) => s.key !== "patient") : FULL_STEPS;
    const [step, setStep] = useState(0);
    const [patientId, setPatientId] = useState(isPatient ? user?.patient_id ?? null : null);
    // If the cached login doesn't have patient_id (older session), fetch /auth/me
    // and back-fill it so the Confirm button isn't permanently disabled.
    useEffect(() => {
        if (isPatient && patientId == null) {
            api.get("/auth/me").then((res) => {
                const pid = res.data?.patient_id;
                if (pid) {
                    setPatientId(pid);
                    const auth = useAuthStore.getState();
                    if (auth.user)
                        auth.setSession(auth.accessToken, auth.refreshToken, { ...auth.user, patient_id: pid });
                }
            }).catch(() => undefined);
        }
    }, [isPatient, patientId]);
    const [branchId, setBranchId] = useState(null);
    const [doctorId, setDoctorId] = useState(null);
    const [slot, setSlot] = useState(null);
    const [reason, setReason] = useState("");
    // Patients can't list other patients — skip this query for them.
    const patients = useQuery({
        queryKey: ["patients-mini"],
        queryFn: async () => (await api.get("/patients/", { params: { page_size: 50 } })).data,
        enabled: !isPatient,
    });
    const branches = useQuery({
        queryKey: ["branches"],
        queryFn: async () => (await api.get("/branches/")).data,
    });
    const doctors = useQuery({
        queryKey: ["doctors-by-branch", branchId],
        queryFn: async () => (await api.get("/doctors/", { params: { branch_id: branchId, page_size: 50 } })).data,
        enabled: !!branchId,
    });
    const slots = useQuery({
        queryKey: ["slots-for-doctor", doctorId, branchId],
        queryFn: async () => (await api.get(`/doctors/${doctorId}/availability`, {
            params: { branch_id: branchId },
        })).data,
        enabled: !!doctorId && !!branchId,
    });
    const create = useMutation({
        mutationFn: async (payload) => (await api.post("/appointments/", payload)).data,
        onSuccess: () => navigate("/appointments"),
    });
    useEffect(() => setDoctorId(null), [branchId]);
    useEffect(() => setSlot(null), [doctorId]);
    function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
    function back() { setStep((s) => Math.max(s - 1, 0)); }
    const patient = (patients.data?.data || []).find((p) => p.id === patientId);
    const branch = (branches.data?.data || []).find((b) => b.id === branchId);
    const doctor = (doctors.data?.data || []).find((d) => d.id === doctorId);
    return (_jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("button", { onClick: () => navigate(-1), className: "inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 mb-3", children: [_jsx(ArrowLeft, { size: 12 }), " Back"] }), _jsx(PageHeader, { title: "Book appointment", subtitle: "6-step guided booking", icon: _jsx(Calendar, { size: 20 }) }), _jsx("ol", { className: "flex items-center gap-2 mb-6 overflow-x-auto pb-2", children: STEPS.map((s, i) => {
                    const done = i < step;
                    const active = i === step;
                    return (_jsxs("li", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("button", { onClick: () => i <= step && setStep(i), className: `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${active
                                    ? "bg-brand-600 text-white shadow-soft"
                                    : done
                                        ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                                        : "bg-ink-100 text-ink-500"}`, children: [done ? _jsx(CheckCircle2, { size: 12 }) : s.icon, s.title] }), i < STEPS.length - 1 && _jsx("span", { className: `h-px w-6 ${done ? "bg-brand-300" : "bg-ink-200"}` })] }, s.key));
                }) }), _jsx(Card, { children: _jsxs(CardBody, { children: [STEPS[step]?.key === "patient" && (_jsx(Picker, { loading: patients.isLoading, options: (patients.data?.data || []).map((p) => ({
                                id: p.id,
                                title: p.full_name_en,
                                subtitle: p.phone || p.code,
                                avatar: p.full_name_en,
                            })), selected: patientId, onPick: (id) => { setPatientId(id); next(); } })), STEPS[step]?.key === "branch" && (_jsx(Picker, { loading: branches.isLoading, options: (branches.data?.data || []).map((b) => ({
                                id: b.id,
                                title: b.name,
                                subtitle: `${b.city || ""}${b.phone ? ` · ${b.phone}` : ""}`,
                                avatar: b.name,
                            })), selected: branchId, onPick: (id) => { setBranchId(id); next(); } })), STEPS[step]?.key === "doctor" && (_jsx(Picker, { loading: doctors.isLoading, options: (doctors.data?.data || []).map((d) => ({
                                id: d.id,
                                title: d.user?.full_name,
                                subtitle: (d.specialties || []).map((s) => s.name).join(" · "),
                                avatar: d.user?.full_name,
                            })), selected: doctorId, onPick: (id) => { setDoctorId(id); next(); } })), STEPS[step]?.key === "slot" && (_jsx(SlotGrid, { loading: slots.isLoading, slots: slots.data?.slots || [], selected: slot, onPick: (starts_at) => { setSlot(starts_at); next(); } })), STEPS[step]?.key === "reason" && (_jsxs("div", { className: "space-y-3", children: [_jsx("label", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500", children: "Reason / symptoms (optional)" }), _jsx("textarea", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "e.g. chest pain, follow-up review, lab results", rows: 5, className: "w-full border border-ink-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" }), _jsxs("div", { className: "flex justify-between", children: [_jsx("button", { onClick: back, className: "text-sm text-ink-500 hover:text-ink-700", children: "Back" }), _jsxs("button", { onClick: next, className: "inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-soft", children: ["Continue ", _jsx(CheckCircle2, { size: 14 })] })] })] })), STEPS[step]?.key === "confirm" && (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "text-sm text-ink-500 mb-2", children: "Review your booking" }), !isPatient && (_jsx(Summary, { label: "Patient", value: patient?.full_name_en, icon: _jsx(User, { size: 12 }) })), _jsx(Summary, { label: "Branch", value: branch?.name, icon: _jsx(Building2, { size: 12 }) }), _jsx(Summary, { label: "Doctor", value: doctor?.user?.full_name + (doctor ? ` · ${(doctor.specialties || []).map((s) => s.name).join(", ")}` : ""), icon: _jsx(Stethoscope, { size: 12 }) }), _jsx(Summary, { label: "When", value: slot?.replace("T", " ").slice(0, 16), icon: _jsx(Clock, { size: 12 }), mono: true }), _jsx(Summary, { label: "Reason", value: reason || "(none)", icon: _jsx(MessageSquare, { size: 12 }) }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx("button", { onClick: back, className: "rounded-lg border border-ink-200 text-ink-700 text-sm px-4 py-2 hover:bg-ink-50", children: "Back" }), _jsxs("button", { disabled: !patientId || !doctorId || !branchId || !slot || create.isPending, onClick: () => create.mutate({ patient_id: patientId, doctor_id: doctorId, branch_id: branchId, starts_at: slot, reason }), className: "bg-brand-gradient text-white text-sm rounded-lg px-5 py-2 disabled:opacity-60 inline-flex items-center gap-1.5 shadow-soft", children: [create.isPending ? "Booking…" : "Confirm & book", !create.isPending && _jsx(CheckCircle2, { size: 14 })] })] }), create.isError && (_jsx("p", { className: "text-rose-700 text-xs bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: create.error?.response?.data?.error?.message }))] }))] }) })] }));
}
function Picker({ options, selected, onPick, loading, }) {
    if (loading) {
        return _jsx("div", { className: "space-y-2", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-12 bg-ink-100 rounded animate-pulse" }, i))) });
    }
    if (!options.length)
        return _jsx("p", { className: "text-sm text-ink-500", children: "No options available." });
    return (_jsx("ul", { className: "grid grid-cols-1 md:grid-cols-2 gap-2", children: options.map((o) => (_jsx("li", { children: _jsxs("button", { onClick: () => onPick(o.id), className: `w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${selected === o.id
                    ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
                    : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/30"}`, children: [_jsx(Avatar, { name: o.avatar || o.title, size: "sm" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-ink-800 truncate", children: o.title }), o.subtitle && _jsx("div", { className: "text-xs text-ink-500 truncate", children: o.subtitle })] })] }) }, o.id))) }));
}
function SlotGrid({ slots, selected, onPick, loading, }) {
    if (loading) {
        return _jsx("div", { className: "grid grid-cols-3 gap-2", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-14 bg-ink-100 rounded animate-pulse" }, i))) });
    }
    if (!slots.length)
        return _jsx("p", { className: "text-sm text-ink-500", children: "No available slots in the next week." });
    // Group by date
    const byDate = {};
    slots.forEach((s) => {
        byDate[s.date] = byDate[s.date] || [];
        byDate[s.date].push(s);
    });
    return (_jsx("div", { className: "space-y-4", children: Object.entries(byDate).map(([date, ss]) => (_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2", children: date }), _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2", children: ss.map((s, i) => (_jsxs("button", { onClick: () => onPick(s.starts_at), className: `rounded-lg px-3 py-2 text-sm font-medium transition border text-left ${selected === s.starts_at
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 text-ink-700"}`, children: [s.start, " \u2013 ", s.end] }, i))) })] }, date))) }));
}
function Summary({ icon, label, value, mono, }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-3 py-2 border-b border-ink-100 last:border-b-0", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500", children: [_jsx("span", { className: "text-ink-400", children: icon }), label] }), _jsx("div", { className: `text-sm font-medium text-ink-800 text-right ${mono ? "font-mono" : ""}`, children: value || "—" })] }));
}
