import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save, ShieldCheck, Stethoscope, X } from "lucide-react";

import { api } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, opens in edit mode for an existing doctor. */
  existing?: any;
}

interface CreatedDoctor {
  id: number;
  full_name: string;
  email: string;
  temporary_password: string;
  message: string;
}

export function NewDoctorModal({ open, onClose, existing }: Props) {
  const editing = !!existing;
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
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
    specialty_ids: [] as number[],
    branch_ids: [] as number[],
  });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedDoctor | null>(null);

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
        specialty_ids: (existing.specialties || []).map((s: any) => s.id),
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
    mutationFn: async (body: any) => {
      if (editing) return (await api.patch(`/doctors/${existing.id}`, body)).data;
      return (await api.post("/doctors/", body)).data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      if (editing) {
        onClose();
      } else {
        setCreated(data as CreatedDoctor);
      }
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to save doctor"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: any = { ...form };
    payload.languages = form.languages.split(",").map((s: string) => s.trim()).filter(Boolean);
    payload.years_of_experience = form.years_of_experience ? Number(form.years_of_experience) : undefined;
    payload.consultation_fee = form.consultation_fee ? Number(form.consultation_fee) : undefined;
    payload.appointment_duration_minutes = Number(form.appointment_duration_minutes) || 30;
    save.mutate(payload);
  }

  function toggleSpec(id: number) {
    const ids = new Set(form.specialty_ids);
    ids.has(id) ? ids.delete(id) : ids.add(id);
    setForm({ ...form, specialty_ids: Array.from(ids) });
  }
  function toggleBranch(id: number) {
    const ids = new Set(form.branch_ids);
    ids.has(id) ? ids.delete(id) : ids.add(id);
    setForm({ ...form, branch_ids: Array.from(ids) });
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lift max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <Stethoscope size={16} />
            {created ? "Doctor created" : editing ? "Edit doctor" : "Onboard a new doctor"}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>

        {created ? (
          <SuccessPanel doctor={created} onDone={() => { setCreated(null); onClose(); }} />
        ) : (
          <form onSubmit={onSubmit} className="p-5 space-y-5">
            <Section title="Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Full name (English) *" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} required />
                <Field label="Full name (Arabic)" value={form.full_name_ar} onChange={(v) => setForm({ ...form, full_name_ar: v })} />
                <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required placeholder="dr.name@clinic.com" />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>
            </Section>

            <Section title="Credentials">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="License number *" value={form.license_number} onChange={(v) => setForm({ ...form, license_number: v })} required />
                <Field label="Years of experience" type="number" value={form.years_of_experience} onChange={(v) => setForm({ ...form, years_of_experience: v })} />
                <Field label="Languages (comma-separated)" value={form.languages} onChange={(v) => setForm({ ...form, languages: v })} placeholder="en, ar" />
                <Field label="Consultation fee" type="number" value={form.consultation_fee} onChange={(v) => setForm({ ...form, consultation_fee: v })} />
                <Field label="Default appointment minutes" type="number" value={form.appointment_duration_minutes} onChange={(v) => setForm({ ...form, appointment_duration_minutes: v })} />
                <Toggle label="Available for online (telemedicine) appointments" checked={form.online_appointments} onChange={(v) => setForm({ ...form, online_appointments: v })} />
              </div>
            </Section>

            <Section title="Specialties">
              <ChipMultiSelect
                items={(specialties.data?.data || []).map((s: any) => ({ id: s.id, label: s.name }))}
                selected={new Set(form.specialty_ids)}
                onToggle={toggleSpec}
                empty="No specialties seeded yet."
              />
            </Section>

            <Section title="Branches">
              <ChipMultiSelect
                items={(branches.data?.data || []).map((b: any) => ({ id: b.id, label: b.name }))}
                selected={new Set(form.branch_ids)}
                onToggle={toggleBranch}
                empty="No branches configured."
              />
            </Section>

            <Section title="Bio">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                placeholder="Short professional summary visible to patients."
                className="w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Section>

            {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
              >
                {save.isPending ? <Loader2 size={14} className="animate-spin" /> : editing ? <Save size={14} /> : <Stethoscope size={14} />}
                {save.isPending ? "Saving…" : editing ? "Save changes" : "Create doctor"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessPanel({ doctor, onDone }: { doctor: CreatedDoctor; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(`Email: ${doctor.email}\nPassword: ${doctor.temporary_password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-sm">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
          <ShieldCheck size={16} /> {doctor.full_name} can now log in
        </div>
        <p className="text-emerald-700 mt-1">{doctor.message}</p>
      </div>

      <div className="rounded-xl border border-ink-200 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-500">Email</span>
          <span className="font-mono text-ink-800">{doctor.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-500">Temporary password</span>
          <span className="font-mono text-ink-800">{doctor.temporary_password}</span>
        </div>
        <button
          onClick={copy}
          className="mt-2 inline-flex items-center gap-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium px-3 py-1.5 rounded-md"
        >
          <Copy size={12} /> {copied ? "Copied!" : "Copy credentials"}
        </button>
      </div>

      <p className="text-xs text-ink-500">
        Share this securely with the doctor. They should change the password on first login. The password
        will not be shown again.
      </p>

      <div className="flex justify-end pt-2 border-t border-ink-100">
        <button onClick={onDone} className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg shadow-soft">
          Done
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, required, type,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <input
        value={value}
        type={type || "text"}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left col-span-1 md:col-span-2"
    >
      <span className={`w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`}>
        <span className="size-5 rounded-full bg-white shadow-soft" />
      </span>
      <span className="text-sm text-ink-700">{label}</span>
    </button>
  );
}

function ChipMultiSelect({
  items, selected, onToggle, empty,
}: {
  items: { id: number; label: string }[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  empty: string;
}) {
  if (items.length === 0) return <p className="text-xs text-ink-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const on = selected.has(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={`text-xs px-2.5 py-1 rounded-full transition ring-1 ring-inset ${
              on
                ? "bg-brand-600 text-white ring-brand-600"
                : "bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
