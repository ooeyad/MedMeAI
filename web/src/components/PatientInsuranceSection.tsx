import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";

import { api } from "../api/client";
import { Badge } from "./ui/Badge";
import { Card, CardBody, CardHeader } from "./ui/Card";

interface Props {
  patientId: number;
}

export function PatientInsuranceSection({ patientId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const list = useQuery({
    queryKey: ["patient-insurance", patientId],
    queryFn: async () => (await api.get(`/insurance/patients/${patientId}`)).data,
  });
  const companies = useQuery({
    queryKey: ["insurance-companies-pick"],
    queryFn: async () => (await api.get("/insurance/companies")).data,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/insurance/patient-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-insurance", patientId] }),
  });

  const items: any[] = list.data?.data || [];
  const companyMap = new Map(
    ((companies.data?.data || []) as any[]).map((c: any) => [c.id, c]),
  );

  return (
    <Card>
      <CardHeader
        title="Insurance plans"
        icon={<ShieldCheck size={16} />}
        description={`${items.length} plan${items.length === 1 ? "" : "s"} on file`}
        action={
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-1.5 shadow-soft"
          >
            <Plus size={14} /> Add plan
          </button>
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-ink-500">No insurance plans on file.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((p: any) => {
              const company = companyMap.get(p.insurance_company_id);
              return (
                <li key={p.id} className="py-3 flex items-center gap-3 text-sm">
                  <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
                    <ShieldCheck size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-800">
                      {company?.name || `Company #${p.insurance_company_id}`}
                      {p.is_primary && <span className="ml-2 text-[10px] uppercase tracking-wider text-brand-600 font-semibold">primary</span>}
                    </div>
                    <div className="text-xs text-ink-500">
                      {p.network_tier || "—"}
                      {p.member_number && <> · member <span className="font-mono">{p.member_number}</span></>}
                      {p.expiry_date && <> · exp {p.expiry_date}</>}
                      {p.copayment != null && <> · co-pay {p.copayment}</>}
                    </div>
                  </div>
                  <Badge tone="info">{(p.status || "").replaceAll("_", " ")}</Badge>
                  <button
                    onClick={() => { setEditing(p); setShowForm(true); }}
                    className="text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => confirm("Remove this plan?") && remove.mutate(p.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      {showForm && (
        <PlanForm
          patientId={patientId}
          existing={editing}
          companies={(companies.data?.data || []) as any[]}
          onClose={() => setShowForm(false)}
        />
      )}
    </Card>
  );
}

function PlanForm({
  patientId, existing, companies, onClose,
}: {
  patientId: number; existing: any | null; companies: any[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    insurance_company_id: existing?.insurance_company_id || (companies[0]?.id ?? ""),
    policy_number: existing?.policy_number || "",
    member_number: existing?.member_number || "",
    network_tier: existing?.network_tier || "",
    coverage_type: existing?.coverage_type || "",
    expiry_date: existing?.expiry_date || "",
    deductible: existing?.deductible ?? "",
    copayment: existing?.copayment ?? "",
    approval_required: existing?.approval_required ?? true,
    is_primary: existing?.is_primary ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        insurance_company_id: Number(form.insurance_company_id),
        deductible: form.deductible ? Number(form.deductible) : null,
        copayment: form.copayment ? Number(form.copayment) : null,
      };
      if (!payload.expiry_date) delete payload.expiry_date;
      if (existing) return (await api.patch(`/insurance/patient-records/${existing.id}`, payload)).data;
      return (await api.post(`/insurance/patients/${patientId}`, payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-insurance", patientId] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to save plan"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <ShieldCheck size={16} /> {existing ? "Edit insurance plan" : "Add insurance plan"}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-700">Insurance company *</label>
            <select
              value={form.insurance_company_id}
              onChange={(e) => setForm({ ...form, insurance_company_id: e.target.value })}
              className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              required
            >
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Member number" value={form.member_number} onChange={(v) => setForm({ ...form, member_number: v })} />
            <Field label="Policy number" value={form.policy_number} onChange={(v) => setForm({ ...form, policy_number: v })} />
            <Field label="Network tier" value={form.network_tier} onChange={(v) => setForm({ ...form, network_tier: v })} placeholder="Gold / Silver" />
            <Field label="Coverage type" value={form.coverage_type} onChange={(v) => setForm({ ...form, coverage_type: v })} placeholder="employee / family" />
            <Field label="Expiry date" type="date" value={form.expiry_date} onChange={(v) => setForm({ ...form, expiry_date: v })} />
            <Field label="Deductible" type="number" value={form.deductible} onChange={(v) => setForm({ ...form, deductible: v })} />
            <Field label="Co-payment" type="number" value={form.copayment} onChange={(v) => setForm({ ...form, copayment: v })} />
          </div>
          <div className="flex items-center gap-4">
            <Toggle label="Primary plan" checked={form.is_primary} onChange={(v) => setForm({ ...form, is_primary: v })} />
            <Toggle label="Approval required" checked={form.approval_required} onChange={(v) => setForm({ ...form, approval_required: v })} />
          </div>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">Cancel</button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
            >
              {save.isPending ? "Saving…" : existing ? "Save changes" : "Add plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type,
}: {
  label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <input
        type={type || "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm">
      <span className={`w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`}>
        <span className="size-5 rounded-full bg-white shadow-soft" />
      </span>
      <span className="text-ink-700">{label}</span>
    </button>
  );
}
