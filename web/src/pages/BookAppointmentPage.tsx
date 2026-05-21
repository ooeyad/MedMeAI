import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Stethoscope,
  User,
} from "lucide-react";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";

interface Step {
  key: string;
  title: string;
  icon: React.ReactNode;
}
const FULL_STEPS: Step[] = [
  { key: "patient", title: "Patient", icon: <User size={14} /> },
  { key: "branch", title: "Branch", icon: <Building2 size={14} /> },
  { key: "doctor", title: "Doctor", icon: <Stethoscope size={14} /> },
  { key: "slot", title: "Slot", icon: <Clock size={14} /> },
  { key: "reason", title: "Reason", icon: <MessageSquare size={14} /> },
  { key: "confirm", title: "Confirm", icon: <CheckCircle2 size={14} /> },
];

export function BookAppointmentPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isPatient = (user?.roles || []).includes("patient");
  // Patients book for themselves — skip the patient picker entirely.
  const STEPS = isPatient ? FULL_STEPS.filter((s) => s.key !== "patient") : FULL_STEPS;
  const [step, setStep] = useState(0);
  const [patientId, setPatientId] = useState<number | null>(isPatient ? user?.patient_id ?? null : null);

  // If the cached login doesn't have patient_id (older session), fetch /auth/me
  // and back-fill it so the Confirm button isn't permanently disabled.
  useEffect(() => {
    if (isPatient && patientId == null) {
      api.get("/auth/me").then((res) => {
        const pid = res.data?.patient_id;
        if (pid) {
          setPatientId(pid);
          const auth = useAuthStore.getState();
          if (auth.user) auth.setSession(auth.accessToken!, auth.refreshToken!, { ...auth.user, patient_id: pid });
        }
      }).catch(() => undefined);
    }
  }, [isPatient, patientId]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
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
    queryFn: async () => (
      await api.get(`/doctors/${doctorId}/availability`, {
        params: { branch_id: branchId },
      })
    ).data,
    enabled: !!doctorId && !!branchId,
  });

  const create = useMutation({
    mutationFn: async (payload: any) => (await api.post("/appointments/", payload)).data,
    onSuccess: () => navigate("/appointments"),
  });

  useEffect(() => setDoctorId(null), [branchId]);
  useEffect(() => setSlot(null), [doctorId]);

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  const patient = (patients.data?.data || []).find((p: any) => p.id === patientId);
  const branch = (branches.data?.data || []).find((b: any) => b.id === branchId);
  const doctor = (doctors.data?.data || []).find((d: any) => d.id === doctorId);

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 mb-3"
      >
        <ArrowLeft size={12} /> Back
      </button>
      <PageHeader title="Book appointment" subtitle="6-step guided booking" icon={<Calendar size={20} />} />

      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.key} className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => i <= step && setStep(i)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-brand-600 text-white shadow-soft"
                    : done
                    ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
                    : "bg-ink-100 text-ink-500"
                }`}
              >
                {done ? <CheckCircle2 size={12} /> : s.icon}
                {s.title}
              </button>
              {i < STEPS.length - 1 && <span className={`h-px w-6 ${done ? "bg-brand-300" : "bg-ink-200"}`} />}
            </li>
          );
        })}
      </ol>

      <Card>
        <CardBody>
          {STEPS[step]?.key === "patient" && (
            <Picker
              loading={patients.isLoading}
              options={(patients.data?.data || []).map((p: any) => ({
                id: p.id,
                title: p.full_name_en,
                subtitle: p.phone || p.code,
                avatar: p.full_name_en,
              }))}
              selected={patientId}
              onPick={(id) => { setPatientId(id); next(); }}
            />
          )}
          {STEPS[step]?.key === "branch" && (
            <Picker
              loading={branches.isLoading}
              options={(branches.data?.data || []).map((b: any) => ({
                id: b.id,
                title: b.name,
                subtitle: `${b.city || ""}${b.phone ? ` · ${b.phone}` : ""}`,
                avatar: b.name,
              }))}
              selected={branchId}
              onPick={(id) => { setBranchId(id); next(); }}
            />
          )}
          {STEPS[step]?.key === "doctor" && (
            <Picker
              loading={doctors.isLoading}
              options={(doctors.data?.data || []).map((d: any) => ({
                id: d.id,
                title: d.user?.full_name,
                subtitle: (d.specialties || []).map((s: any) => s.name).join(" · "),
                avatar: d.user?.full_name,
              }))}
              selected={doctorId}
              onPick={(id) => { setDoctorId(id); next(); }}
            />
          )}
          {STEPS[step]?.key === "slot" && (
            <SlotGrid
              loading={slots.isLoading}
              slots={slots.data?.slots || []}
              selected={slot}
              onPick={(starts_at) => { setSlot(starts_at); next(); }}
            />
          )}
          {STEPS[step]?.key === "reason" && (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Reason / symptoms (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. chest pain, follow-up review, lab results"
                rows={5}
                className="w-full border border-ink-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <div className="flex justify-between">
                <button onClick={back} className="text-sm text-ink-500 hover:text-ink-700">
                  Back
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-soft"
                >
                  Continue <CheckCircle2 size={14} />
                </button>
              </div>
            </div>
          )}
          {STEPS[step]?.key === "confirm" && (
            <div className="space-y-4">
              <div className="text-sm text-ink-500 mb-2">Review your booking</div>
              {!isPatient && (
                <Summary label="Patient" value={patient?.full_name_en} icon={<User size={12} />} />
              )}
              <Summary label="Branch" value={branch?.name} icon={<Building2 size={12} />} />
              <Summary
                label="Doctor"
                value={doctor?.user?.full_name + (doctor ? ` · ${(doctor.specialties || []).map((s: any) => s.name).join(", ")}` : "")}
                icon={<Stethoscope size={12} />}
              />
              <Summary label="When" value={slot?.replace("T", " ").slice(0, 16)} icon={<Clock size={12} />} mono />
              <Summary label="Reason" value={reason || "(none)"} icon={<MessageSquare size={12} />} />

              <div className="flex gap-2 pt-2">
                <button
                  onClick={back}
                  className="rounded-lg border border-ink-200 text-ink-700 text-sm px-4 py-2 hover:bg-ink-50"
                >
                  Back
                </button>
                <button
                  disabled={!patientId || !doctorId || !branchId || !slot || create.isPending}
                  onClick={() => create.mutate({ patient_id: patientId, doctor_id: doctorId, branch_id: branchId, starts_at: slot, reason })}
                  className="bg-brand-gradient text-white text-sm rounded-lg px-5 py-2 disabled:opacity-60 inline-flex items-center gap-1.5 shadow-soft"
                >
                  {create.isPending ? "Booking…" : "Confirm & book"}
                  {!create.isPending && <CheckCircle2 size={14} />}
                </button>
              </div>
              {create.isError && (
                <p className="text-rose-700 text-xs bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
                  {(create.error as any)?.response?.data?.error?.message}
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Picker({
  options,
  selected,
  onPick,
  loading,
}: {
  options: { id: number; title: string; subtitle?: string; avatar?: string }[];
  selected: number | null;
  onPick: (id: number) => void;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-12 bg-ink-100 rounded animate-pulse" />
    ))}</div>;
  }
  if (!options.length) return <p className="text-sm text-ink-500">No options available.</p>;
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {options.map((o) => (
        <li key={o.id}>
          <button
            onClick={() => onPick(o.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
              selected === o.id
                ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-300"
                : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/30"
            }`}
          >
            <Avatar name={o.avatar || o.title} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-800 truncate">{o.title}</div>
              {o.subtitle && <div className="text-xs text-ink-500 truncate">{o.subtitle}</div>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SlotGrid({
  slots,
  selected,
  onPick,
  loading,
}: {
  slots: any[];
  selected: string | null;
  onPick: (starts_at: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="grid grid-cols-3 gap-2">{Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-14 bg-ink-100 rounded animate-pulse" />
    ))}</div>;
  }
  if (!slots.length) return <p className="text-sm text-ink-500">No available slots in the next week.</p>;
  // Group by date
  const byDate: Record<string, any[]> = {};
  slots.forEach((s) => {
    byDate[s.date] = byDate[s.date] || [];
    byDate[s.date].push(s);
  });
  return (
    <div className="space-y-4">
      {Object.entries(byDate).map(([date, ss]) => (
        <div key={date}>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">{date}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {ss.map((s, i) => (
              <button
                key={i}
                onClick={() => onPick(s.starts_at)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition border text-left ${
                  selected === s.starts_at
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 text-ink-700"
                }`}
              >
                {s.start} – {s.end}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Summary({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-ink-100 last:border-b-0">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-500">
        <span className="text-ink-400">{icon}</span>{label}
      </div>
      <div className={`text-sm font-medium text-ink-800 text-right ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}
