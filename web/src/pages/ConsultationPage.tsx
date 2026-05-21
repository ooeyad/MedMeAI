import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Beaker,
  CheckCircle2,
  ClipboardList,
  Droplet,
  FlaskConical,
  HeartPulse,
  NotebookPen,
  Phone,
  Pill,
  Plus,
  Save,
  Thermometer,
  Trash2,
  User,
} from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";

type Tab = "overview" | "notes" | "prescriptions" | "labs" | "imaging" | "vitals";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <ClipboardList size={14} /> },
  { key: "notes", label: "Diagnosis & notes", icon: <NotebookPen size={14} /> },
  { key: "prescriptions", label: "Prescriptions", icon: <Pill size={14} /> },
  { key: "labs", label: "Lab tests", icon: <FlaskConical size={14} /> },
  { key: "imaging", label: "Imaging & procedures", icon: <Beaker size={14} /> },
  { key: "vitals", label: "Vitals", icon: <Activity size={14} /> },
];

// Quick-pick lists are now data-driven via /billing/items.
// Hooks below fetch them from the catalog the admin manages in /price-list.
function useCatalogPicks(kind: string) {
  return useQuery({
    queryKey: ["catalog-picks", kind],
    queryFn: async () =>
      (await api.get("/billing/items", { params: { kind, page_size: 50 } })).data,
  });
}

// Medications and procedures are also catalog-driven (kind = medication / procedure).
// Suggested medication form-defaults still need dosage/frequency hints,
// which we derive from the item's `description` field when present.
function useCatalogMeds() {
  return useQuery({
    queryKey: ["catalog-picks", "medication"],
    queryFn: async () =>
      (await api.get("/billing/items", { params: { kind: "medication", page_size: 50 } })).data,
  });
}

export function ConsultationPage() {
  const { appointmentId } = useParams();
  const id = Number(appointmentId);
  const [tab, setTab] = useState<Tab>("overview");
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
    mutationFn: async (action: string) => api.post(`/appointments/${id}/${action}`, {}),
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
    } catch (_) { /* ignore */ }
    navigate("/");
  }

  const status = appt.data?.status;
  const inConsult = status === "in_consultation";
  const completed = status === "completed";

  const apptError = (appt.error as any)?.response?.data?.error?.message || (appt.error as any)?.message;
  const patientError = (patient.error as any)?.response?.data?.error?.message || (patient.error as any)?.message;

  return (
    <div className="max-w-7xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700 mb-3">
        <ArrowLeft size={12} /> Back to queue
      </Link>

      {(apptError || patientError) && (
        <div className="mb-4 rounded-lg bg-rose-50 ring-1 ring-rose-200 text-rose-700 text-sm px-3 py-2">
          {apptError && <div>Appointment: {apptError}</div>}
          {patientError && <div>Patient: {patientError}</div>}
          <div className="text-xs text-rose-600 mt-1">
            Common causes: you're scoped to a different tenant in the header dropdown, or the
            patient was moved to another tenant. Try setting the tenant scope to "All tenants"
            (super admin) or the appointment's home tenant.
          </div>
        </div>
      )}

      {/* Header */}
      <Card className="mb-5">
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Avatar name={patient.data?.full_name_en} size="xl" ring />
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-ink-900 truncate">
                  {patient.data?.full_name_en || "Loading…"}
                </h1>
                <div className="text-sm text-ink-500">
                  {patient.data?.code} · {appt.data?.code}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-600">
                  {patient.data?.date_of_birth && (
                    <span className="inline-flex items-center gap-1">
                      <User size={12} /> Born {patient.data.date_of_birth}
                    </span>
                  )}
                  {patient.data?.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {patient.data.phone}
                    </span>
                  )}
                  {patient.data?.blood_type && (
                    <span className="inline-flex items-center gap-1">
                      <Droplet size={12} /> {patient.data.blood_type}
                    </span>
                  )}
                  <Badge tone={statusTone(status || "")} dot pulse={inConsult}>
                    {(status || "—").replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status === "checked_in" && (
                <button
                  onClick={startConsult}
                  className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-4 py-2 shadow-soft font-medium"
                >
                  <Activity size={14} /> Start consultation
                </button>
              )}
              {inConsult && (
                <button
                  onClick={completeConsult}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-4 py-2 shadow-soft font-medium"
                >
                  <CheckCircle2 size={14} /> Complete consultation
                </button>
              )}
            </div>
          </div>

          {/* Medical alerts */}
          {(patient.data?.allergies?.length || patient.data?.chronic_diseases?.length) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {patient.data.allergies?.length > 0 && (
                <Alert
                  icon={<AlertCircle size={14} />}
                  tone="rose"
                  label="Allergies"
                  items={patient.data.allergies}
                />
              )}
              {patient.data.chronic_diseases?.length > 0 && (
                <Alert
                  icon={<HeartPulse size={14} />}
                  tone="amber"
                  label="Chronic conditions"
                  items={patient.data.chronic_diseases}
                />
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="mb-4 border-b border-ink-200 flex items-center gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px",
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab patient={patient.data} appt={appt.data} note={note.data} rxs={rx.data?.data || []} labs={labs.data?.data || []} vitals={vitals.data} />
      )}
      {tab === "notes" && <NotesTab appointmentId={id} initial={note.data} readonly={completed} />}
      {tab === "prescriptions" && <PrescriptionsTab appointmentId={id} items={rx.data?.data || []} readonly={completed} />}
      {tab === "labs" && (
        <OrderTab
          appointmentId={id}
          items={(labs.data?.data || []).filter((o: any) => (o.kind || "lab") === "lab")}
          readonly={completed}
          kind="lab"
          title="Laboratory tests"
          subtitle="Order tests and record results as they come back"
          icon={<FlaskConical size={16} />}
          accent="violet"
          suggestionKind="lab_test"
        />
      )}
      {tab === "imaging" && (
        <OrderTab
          appointmentId={id}
          items={(labs.data?.data || []).filter((o: any) => o.kind === "imaging" || o.kind === "procedure" || o.kind === "referral")}
          readonly={completed}
          kind="imaging"
          title="Imaging & procedures"
          subtitle="X-ray, ultrasound, ECG, biopsies, referrals"
          icon={<Beaker size={16} />}
          accent="sky"
          suggestionKind="imaging"
          extraSuggestionKind="procedure"
          allowKindSelect
        />
      )}
      {tab === "vitals" && <VitalsTab appointmentId={id} initial={vitals.data} readonly={completed} />}
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================
function OverviewTab({ patient, appt, note, rxs, labs, vitals }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Reason for visit" icon={<ClipboardList size={16} />} />
        <CardBody>
          <div className="text-sm">
            <div className="text-ink-500">Chief complaint</div>
            <div className="font-medium text-ink-800 mt-0.5">{appt?.reason || "Not stated"}</div>
            {appt?.symptoms && (
              <>
                <div className="text-ink-500 mt-3">Symptoms</div>
                <div className="text-ink-700 mt-0.5">{appt.symptoms}</div>
              </>
            )}
            {note?.diagnosis && (
              <>
                <div className="text-ink-500 mt-3">Working diagnosis</div>
                <div className="text-ink-700 mt-0.5">{note.diagnosis}</div>
              </>
            )}
            {note?.treatment_plan && (
              <>
                <div className="text-ink-500 mt-3">Plan</div>
                <div className="text-ink-700 mt-0.5">{note.treatment_plan}</div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Medications & allergies" icon={<Pill size={16} />} />
        <CardBody>
          <div className="space-y-3 text-sm">
            <Field label="Allergies" items={patient?.allergies || []} tone="bg-rose-50 text-rose-700 ring-rose-200" />
            <Field label="Chronic" items={patient?.chronic_diseases || []} tone="bg-amber-50 text-amber-700 ring-amber-200" />
            <Field label="Current meds" items={patient?.current_medications || []} tone="bg-brand-50 text-brand-700 ring-brand-200" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Latest vitals"
          icon={<Activity size={16} />}
          description={vitals?.recorded_at ? `Recorded ${vitals.recorded_at.slice(0, 16).replace("T", " ")}` : "Not captured yet"}
        />
        <CardBody>
          {vitals && (vitals.weight_kg || vitals.heart_rate_bpm) ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat icon={<Thermometer size={12} />} label="Temp" value={vitals.temperature_c ? `${vitals.temperature_c}°C` : "—"} />
              <Stat icon={<HeartPulse size={12} />} label="HR" value={vitals.heart_rate_bpm ? `${vitals.heart_rate_bpm} bpm` : "—"} />
              <Stat icon={<Activity size={12} />} label="BP" value={vitals.blood_pressure_systolic ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : "—"} />
              <Stat icon={<Droplet size={12} />} label="SpO2" value={vitals.oxygen_saturation ? `${vitals.oxygen_saturation}%` : "—"} />
            </div>
          ) : (
            <p className="text-sm text-ink-500">No vitals captured for this visit.</p>
          )}
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="This visit"
          icon={<Pill size={16} />}
          description={`${rxs.length} prescription${rxs.length === 1 ? "" : "s"} · ${labs.length} lab order${labs.length === 1 ? "" : "s"}`}
        />
        <CardBody>
          {rxs.length === 0 && labs.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing prescribed or ordered yet.</p>
          ) : (
            <div className="space-y-3">
              {rxs.slice(0, 3).map((r: any) => (
                <div key={r.id} className="text-sm flex items-center gap-2">
                  <Pill size={12} className="text-brand-500" />
                  <span className="font-medium text-ink-800">{r.medication}</span>
                  <span className="text-ink-500">{r.dosage} {r.frequency ? `· ${r.frequency}` : ""}</span>
                  <Badge tone={statusTone(r.status)} className="ml-auto">{r.status}</Badge>
                </div>
              ))}
              {labs.slice(0, 3).map((l: any) => (
                <div key={l.id} className="text-sm flex items-center gap-2">
                  <FlaskConical size={12} className="text-violet-500" />
                  <span className="font-medium text-ink-800">{l.test_name}</span>
                  <span className="text-ink-500">· {l.priority}</span>
                  <Badge tone={statusTone(l.status)} className="ml-auto">{l.status.replaceAll("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function NotesTab({ appointmentId, initial, readonly }: { appointmentId: number; initial: any; readonly: boolean }) {
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

  return (
    <Card>
      <CardHeader
        title="Clinical notes"
        icon={<NotebookPen size={16} />}
        action={!readonly && (
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft"
          >
            <Save size={14} /> {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save notes"}
          </button>
        )}
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Textarea label="Chief complaint" value={form.chief_complaint} onChange={(v) => setForm({ ...form, chief_complaint: v })} readonly={readonly} />
          <Textarea label="History of present illness" value={form.history_of_present_illness} onChange={(v) => setForm({ ...form, history_of_present_illness: v })} readonly={readonly} />
          <Textarea label="Examination findings" value={form.examination} onChange={(v) => setForm({ ...form, examination: v })} readonly={readonly} />
          <Textarea label="Diagnosis" value={form.diagnosis} onChange={(v) => setForm({ ...form, diagnosis: v })} readonly={readonly} />
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">ICD-10 codes</label>
            <input
              value={form.icd10_codes}
              onChange={(e) => setForm({ ...form, icd10_codes: e.target.value })}
              readOnly={readonly}
              placeholder="e.g. I10, E11.9"
              className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">Follow-up (days)</label>
            <input
              type="number"
              value={form.follow_up_in_days}
              onChange={(e) => setForm({ ...form, follow_up_in_days: e.target.value })}
              readOnly={readonly}
              placeholder="14"
              className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <Textarea label="Treatment plan" value={form.treatment_plan} onChange={(v) => setForm({ ...form, treatment_plan: v })} readonly={readonly} className="md:col-span-2" />
          <Textarea label="Private notes (not shown to patient)" value={form.private_notes} onChange={(v) => setForm({ ...form, private_notes: v })} readonly={readonly} className="md:col-span-2" />
        </div>
      </CardBody>
    </Card>
  );
}

function PrescriptionsTab({ appointmentId, items, readonly }: { appointmentId: number; items: any[]; readonly: boolean }) {
  const qc = useQueryClient();
  const medsQ = useCatalogMeds();
  const meds = (medsQ.data?.data || []) as any[];
  const [form, setForm] = useState({ medication: "", dosage: "", frequency: "", duration_days: "", quantity: "", instructions: "" });
  const [error, setError] = useState<string | null>(null);
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
    onError: (e: any) => setError(e.response?.data?.error?.message || e.message || "Couldn't save prescription"),
  });

  return (
    <div className="space-y-5">
      {!readonly && (
        <Card>
          <CardHeader title="Add prescription" icon={<Pill size={16} />} description="Quick-pick from the catalog or fill the form manually" />
          <CardBody>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider font-semibold text-ink-500 mb-2 flex items-center gap-2">
                Quick pick
                <Link to="/price-list" className="text-[10px] text-brand-700 hover:text-brand-900 font-normal normal-case">
                  Manage catalog →
                </Link>
              </div>
              {medsQ.isLoading ? (
                <div className="text-xs text-ink-400">Loading catalog…</div>
              ) : meds.length === 0 ? (
                <div className="text-xs text-ink-500">
                  No medications in the catalog yet. <Link to="/price-list" className="text-brand-700 underline">Add some</Link>.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {meds.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => setForm({
                        medication: m.name,
                        dosage: m.description || "",
                        frequency: form.frequency,
                        duration_days: form.duration_days,
                        quantity: "",
                        instructions: form.instructions,
                      })}
                      className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 transition"
                      title={m.sku ? `SKU: ${m.sku}` : undefined}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              <Field2 label="Medication" required value={form.medication} onChange={(v) => setForm({ ...form, medication: v })} />
              <Field2 label="Dosage" placeholder="500 mg" value={form.dosage} onChange={(v) => setForm({ ...form, dosage: v })} />
              <Field2 label="Frequency" placeholder="twice daily" value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v })} />
              <Field2 label="Duration (days)" value={form.duration_days} onChange={(v) => setForm({ ...form, duration_days: v })} />
              <Field2 label="Quantity" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
              <Field2 label="Instructions" placeholder="after meals" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} />
            </div>
            {error && (
              <div className="mt-3 text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={() => form.medication && add.mutate()}
                disabled={!form.medication || add.isPending}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft"
              >
                <Plus size={14} /> {add.isPending ? "Adding…" : "Add to prescription list"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Prescriptions on this visit" icon={<Pill size={16} />} description={`${items.length} item${items.length === 1 ? "" : "s"}`} />
        <CardBody>
          {items.length === 0 ? (
            <p className="text-sm text-ink-500">No prescriptions yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((r: any) => (
                <li key={r.id} className="py-3 flex items-center gap-3 text-sm">
                  <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center"><Pill size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-800">{r.medication} {r.dosage}</div>
                    <div className="text-xs text-ink-500">
                      {r.frequency || "—"} · {r.duration_days ? `${r.duration_days} days` : "no duration"} · qty {r.quantity ?? "—"}
                    </div>
                    {r.instructions && <div className="text-xs text-ink-500 italic mt-0.5">{r.instructions}</div>}
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status.replaceAll("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OrderTab({
  appointmentId, items, readonly, kind, title, subtitle, icon, accent,
  suggestionKind, extraSuggestionKind, allowKindSelect,
}: {
  appointmentId: number;
  items: any[];
  readonly: boolean;
  kind: "lab" | "imaging";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "violet" | "sky";
  suggestionKind: string;
  extraSuggestionKind?: string;
  allowKindSelect?: boolean;
}) {
  const suggestionsQ = useCatalogPicks(suggestionKind);
  const extraSuggestionsQ = useQuery({
    queryKey: ["catalog-picks", extraSuggestionKind || "_none"],
    queryFn: async () =>
      (await api.get("/billing/items", { params: { kind: extraSuggestionKind, page_size: 50 } })).data,
    enabled: !!extraSuggestionKind,
  });
  const suggestions = (suggestionsQ.data?.data || []) as any[];
  const extraSuggestions = (extraSuggestionsQ.data?.data || []) as any[];
  const qc = useQueryClient();
  const [form, setForm] = useState<{
    test_name: string; test_code: string; priority: string;
    clinical_notes: string; kind: string;
  }>({ test_name: "", test_code: "", priority: "routine", clinical_notes: "", kind });

  const add = useMutation({
    mutationFn: async () => api.post(`/clinical/appointments/${appointmentId}/lab-orders`, form),
    onSuccess: () => {
      setForm({ test_name: "", test_code: "", priority: "routine", clinical_notes: "", kind });
      qc.invalidateQueries({ queryKey: ["consult-labs", appointmentId] });
    },
  });

  const accentBtn = accent === "violet" ? "bg-violet-600 hover:bg-violet-700" : "bg-sky-600 hover:bg-sky-700";
  const accentChip = accent === "violet" ? "bg-violet-50 text-violet-700 hover:bg-violet-100" : "bg-sky-50 text-sky-700 hover:bg-sky-100";

  return (
    <div className="space-y-5">
      {!readonly && (
        <Card>
          <CardHeader title={title} icon={icon} description={subtitle} />
          <CardBody>
            {/* Quick picks */}
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider font-semibold text-ink-500 mb-2 flex items-center gap-2">
                Quick pick
                <Link to="/price-list" className="text-[10px] text-brand-700 hover:text-brand-900 font-normal normal-case">
                  Manage catalog →
                </Link>
              </div>
              {suggestionsQ.isLoading ? (
                <div className="text-xs text-ink-400">Loading catalog…</div>
              ) : suggestions.length === 0 && extraSuggestions.length === 0 ? (
                <div className="text-xs text-ink-500">
                  No items in the catalog yet. <Link to="/price-list" className="text-brand-700 underline">Add some</Link>.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((it: any) => (
                    <button
                      key={`s-${it.id}`}
                      onClick={() => setForm({ ...form, test_name: it.name, test_code: it.sku, kind: kind === "imaging" ? "imaging" : "lab" })}
                      className={`text-xs px-2.5 py-1 rounded-full transition ${accentChip}`}
                      title={it.sku}
                    >
                      {it.name}
                    </button>
                  ))}
                  {extraSuggestions.map((it: any) => (
                    <button
                      key={`x-${it.id}`}
                      onClick={() => setForm({ ...form, test_name: it.name, test_code: it.sku, kind: "procedure" })}
                      className="text-xs px-2.5 py-1 rounded-full transition bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      title={it.sku}
                    >
                      {it.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field2 label={kind === "imaging" ? "Procedure or imaging study" : "Test name"} required placeholder={kind === "imaging" ? "e.g. Chest X-ray" : "e.g. CBC"} value={form.test_name} onChange={(v) => setForm({ ...form, test_name: v })} />
              <Field2 label={kind === "imaging" ? "Code (CPT/LOINC)" : "Code (LOINC)"} placeholder="optional" value={form.test_code} onChange={(v) => setForm({ ...form, test_code: v })} />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </div>
              {allowKindSelect && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">Type</label>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                  >
                    <option value="imaging">Imaging</option>
                    <option value="procedure">Procedure</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
              )}
              <Field2 label="Clinical notes / indication" placeholder="rule out pneumonia" value={form.clinical_notes} onChange={(v) => setForm({ ...form, clinical_notes: v })} />
            </div>
            <div className="mt-4">
              <button
                onClick={() => form.test_name && add.mutate()}
                disabled={!form.test_name || add.isPending}
                className={`inline-flex items-center gap-1.5 ${accentBtn} text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shadow-soft`}
              >
                <Plus size={14} /> {add.isPending ? "Ordering…" : kind === "imaging" ? "Order procedure" : "Send to lab"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={`${title} for this visit`}
          icon={icon}
          description={`${items.length} order${items.length === 1 ? "" : "s"}`}
        />
        <CardBody>
          {items.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing ordered yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((l: any) => (
                <OrderRow key={l.id} order={l} readonly={readonly} appointmentId={appointmentId} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OrderRow({ order, readonly, appointmentId }: { order: any; readonly: boolean; appointmentId: number }) {
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

  const kindIcon =
    order.kind === "imaging" ? <Beaker size={14} /> :
    order.kind === "procedure" ? <Activity size={14} /> :
    order.kind === "referral" ? <ArrowLeft size={14} className="rotate-180" /> :
    <FlaskConical size={14} />;
  const accent =
    order.kind === "imaging" ? "bg-sky-50 text-sky-600" :
    order.kind === "procedure" ? "bg-emerald-50 text-emerald-600" :
    "bg-violet-50 text-violet-600";

  return (
    <li className="py-3">
      <div className="flex items-start gap-3 text-sm">
        <div className={`size-9 rounded-lg ${accent} grid place-items-center`}>{kindIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-medium text-ink-800">{order.test_name}{order.test_code ? ` (${order.test_code})` : ""}</div>
            <Badge tone={statusTone(order.status)}>{order.status.replaceAll("_", " ")}</Badge>
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            priority: <span className="font-medium">{order.priority}</span>
            {order.clinical_notes ? ` · ${order.clinical_notes}` : ""}
          </div>

          {!editing && order.results && (
            <div className="mt-2 rounded-md bg-emerald-50 ring-1 ring-emerald-200 p-2 text-emerald-800 text-xs whitespace-pre-wrap">
              <div className="font-semibold mb-0.5">Results</div>
              {order.results}
            </div>
          )}
          {editing && (
            <div className="mt-2 space-y-2">
              <textarea
                value={results}
                onChange={(e) => setResults(e.target.value)}
                rows={4}
                placeholder="Enter results / findings…"
                className="w-full rounded-md border border-ink-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-8 rounded-md border border-ink-200 px-2 text-xs"
                >
                  <option value="ordered">Ordered</option>
                  <option value="sample_collected">Sample collected</option>
                  <option value="in_progress">In progress</option>
                  <option value="results_ready">Results ready</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  <Save size={12} /> {save.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setResults(order.results || ""); setStatus(order.status); }}
                  className="text-xs text-ink-500 hover:text-ink-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!editing && !readonly && (
            <div className="mt-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
              >
                <NotebookPen size={12} /> {order.results ? "Edit results" : "Enter results / update status"}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function VitalsTab({ appointmentId, initial, readonly }: { appointmentId: number; initial: any; readonly: boolean }) {
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

  return (
    <Card>
      <CardHeader
        title="Vitals"
        icon={<Activity size={16} />}
        action={!readonly && (
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft"
          >
            <Save size={14} /> {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save vitals"}
          </button>
        )}
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field2 label="Weight (kg)" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} />
          <Field2 label="Height (cm)" value={form.height_cm} onChange={(v) => setForm({ ...form, height_cm: v })} />
          <Field2 label="BP systolic" value={form.blood_pressure_systolic} onChange={(v) => setForm({ ...form, blood_pressure_systolic: v })} />
          <Field2 label="BP diastolic" value={form.blood_pressure_diastolic} onChange={(v) => setForm({ ...form, blood_pressure_diastolic: v })} />
          <Field2 label="Heart rate (bpm)" value={form.heart_rate_bpm} onChange={(v) => setForm({ ...form, heart_rate_bpm: v })} />
          <Field2 label="Temperature (°C)" value={form.temperature_c} onChange={(v) => setForm({ ...form, temperature_c: v })} />
          <Field2 label="Resp. rate" value={form.respiratory_rate} onChange={(v) => setForm({ ...form, respiratory_rate: v })} />
          <Field2 label="SpO2 (%)" value={form.oxygen_saturation} onChange={(v) => setForm({ ...form, oxygen_saturation: v })} />
        </div>
        <Textarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} readonly={readonly} className="mt-4" />
      </CardBody>
    </Card>
  );
}

// ===========================================================================
// Tiny helpers
// ===========================================================================
function Textarea({
  label, value, onChange, readonly, className,
}: {
  label: string; value: string; onChange: (v: string) => void; readonly?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readonly}
        rows={3}
        className="mt-1 w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}

function Field2({
  label, value, onChange, placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
        {label}{required && <span className="text-rose-500">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}

function Field({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-700 mb-1">{label}</div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item} className={`text-xs px-2 py-0.5 rounded-full ring-1 ring-inset ${tone}`}>{item}</span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-ink-400">None</div>
      )}
    </div>
  );
}

function Alert({ icon, tone, label, items }: { icon: React.ReactNode; tone: "rose" | "amber"; label: string; items: string[] }) {
  const cls = tone === "rose" ? "bg-rose-50 ring-rose-200 text-rose-700" : "bg-amber-50 ring-amber-200 text-amber-700";
  return (
    <div className={`rounded-lg ring-1 ring-inset p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
        {icon} {label}
      </div>
      <div className="text-sm font-medium">{items.join(", ")}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <div className="text-[11px] text-ink-500 flex items-center gap-1">{icon}{label}</div>
      <div className="font-semibold text-ink-800 text-sm">{value}</div>
    </div>
  );
}
