import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Pencil, Plus, ShieldCheck, Trash2, Upload, X, XCircle } from "lucide-react";

import { api } from "../api/client";
import { BulkImportModal, ColumnSpec } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";

const COMPANY_IMPORT_COLUMNS: ColumnSpec[] = [
  { key: "name", header: "Name", required: true, aliases: ["insurer", "company"] },
  { key: "code", header: "Code", hint: "Auto-generated if blank" },
  { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name"] },
  { key: "logo_url", header: "Logo URL", aliases: ["logo"] },
  { key: "active", header: "Active", aliases: ["enabled", "status"], hint: "yes/no" },
];

interface Company {
  id: number;
  code: string;
  name: string;
  name_ar?: string | null;
  logo_url?: string | null;
  active: boolean;
}

export function InsuranceCompaniesPage() {
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const canEdit = hasPermission("insurance:write");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get("/insurance/companies")).data,
  });
  const rows: Company[] = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Insurance companies"
        subtitle={`${rows.length} companies in your network lookup`}
        icon={<ShieldCheck size={20} />}
        actions={
          canEdit && (
            <>
              <button
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 text-sm rounded-lg px-3 py-2"
              >
                <Upload size={14} /> Import
              </button>
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft"
              >
                <Plus size={14} /> New company
              </button>
            </>
          )
        }
      />

      <Card>
        {isLoading ? (
          <CardBody>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-ink-100 rounded animate-pulse" />
              ))}
            </div>
          </CardBody>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Building2 size={20} />}
            title="No insurance companies yet"
            description="Add your network of insurers so patients can store their policies and doctors can mark accepted plans."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3">Code</th>
                  <th>Name (EN)</th>
                  <th>Name (AR)</th>
                  <th>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/60 transition">
                    <td className="px-5 py-2 font-mono text-[11px] text-ink-500">{c.code}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        {c.logo_url && (
                          <img
                            src={c.logo_url}
                            alt=""
                            className="size-6 rounded ring-1 ring-ink-200 object-cover bg-white"
                          />
                        )}
                        <span className="font-medium text-ink-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-ink-600">{c.name_ar || "—"}</td>
                    <td className="py-2">
                      {c.active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-400 text-xs">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right">
                      {canEdit && (
                        <button
                          onClick={() => setEditing(c)}
                          className="text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <CompanyModal
          company={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <BulkImportModal
        open={importing}
        onClose={() => setImporting(false)}
        title="Import insurance companies from Excel/CSV"
        entityLabel="company"
        columns={COMPANY_IMPORT_COLUMNS}
        endpoint="/insurance/companies/bulk-import"
        onSuccess={() => qc.invalidateQueries({ queryKey: ["insurance-companies"] })}
      />
    </div>
  );
}

function CompanyModal({ company, onClose }: { company: Company | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: company?.code || "",
    name: company?.name || "",
    name_ar: company?.name_ar || "",
    logo_url: company?.logo_url || "",
    active: company?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (company) return (await api.patch(`/insurance/companies/${company.id}`, form)).data;
      return (await api.post("/insurance/companies", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-companies"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to save company"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!company) return;
      return api.delete(`/insurance/companies/${company.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurance-companies"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to delete company"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <ShieldCheck size={16} /> {company ? "Edit insurance company" : "New insurance company"}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Name (Arabic)" value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
          <Field
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
            placeholder="auto-generated"
          />
          <Field
            label="Logo URL"
            value={form.logo_url}
            onChange={(v) => setForm({ ...form, logo_url: v })}
            placeholder="https://…"
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="size-4 rounded border-ink-300"
            />
            Active (visible when adding patient insurance)
          </label>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-ink-100">
            {company ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete insurance company "${company.name}"?`)) remove.mutate();
                }}
                disabled={remove.isPending}
                className="text-rose-600 hover:text-rose-800 text-sm inline-flex items-center gap-1"
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
              >
                {save.isPending ? "Saving…" : company ? "Save changes" : "Create company"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}
