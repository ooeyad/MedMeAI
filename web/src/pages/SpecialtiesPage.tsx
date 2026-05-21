import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Stethoscope, Trash2, Upload, X } from "lucide-react";

import { api } from "../api/client";
import { BulkImportModal, ColumnSpec } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";

const SPECIALTY_IMPORT_COLUMNS: ColumnSpec[] = [
  { key: "name", header: "Name", required: true, aliases: ["specialty", "english name"] },
  { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name", "name ar"] },
  { key: "slug", header: "Slug", hint: "Auto-generated from name if blank" },
  { key: "description", header: "Description", aliases: ["notes"] },
];

interface Specialty {
  id: number;
  slug: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
}

export function SpecialtiesPage() {
  const [editing, setEditing] = useState<Specialty | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const canEdit = hasPermission("doctors:write");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await api.get("/doctors/specialties")).data,
  });
  const rows: Specialty[] = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Medical specialties"
        subtitle={`${rows.length} specialties in your lookup`}
        icon={<Stethoscope size={20} />}
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
                <Plus size={14} /> New specialty
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
            icon={<Stethoscope size={20} />}
            title="No specialties yet"
            description="Add cardiology, dermatology, paediatrics, etc., so doctors can be tagged with their specialty."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3">Slug</th>
                  <th>Name (EN)</th>
                  <th>Name (AR)</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50/60 transition">
                    <td className="px-5 py-2 font-mono text-[11px] text-ink-500">{s.slug}</td>
                    <td className="py-2 font-medium text-ink-800">{s.name}</td>
                    <td className="py-2 text-ink-600">{s.name_ar || "—"}</td>
                    <td className="py-2 text-ink-500 max-w-md truncate">{s.description || "—"}</td>
                    <td className="px-5 py-2 text-right">
                      {canEdit && (
                        <button
                          onClick={() => setEditing(s)}
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
        <SpecialtyModal
          specialty={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <BulkImportModal
        open={importing}
        onClose={() => setImporting(false)}
        title="Import specialties from Excel/CSV"
        entityLabel="specialty"
        columns={SPECIALTY_IMPORT_COLUMNS}
        endpoint="/doctors/specialties/bulk-import"
        onSuccess={() => qc.invalidateQueries({ queryKey: ["specialties"] })}
      />
    </div>
  );
}

function SpecialtyModal({ specialty, onClose }: { specialty: Specialty | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    slug: specialty?.slug || "",
    name: specialty?.name || "",
    name_ar: specialty?.name_ar || "",
    description: specialty?.description || "",
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (specialty) return (await api.patch(`/doctors/specialties/${specialty.id}`, form)).data;
      return (await api.post("/doctors/specialties", form)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specialties"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to save specialty"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!specialty) return;
      return api.delete(`/doctors/specialties/${specialty.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["specialties"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to delete specialty"),
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
            <Stethoscope size={16} /> {specialty ? "Edit specialty" : "New specialty"}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Name (Arabic)" value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
          <Field
            label="Slug"
            value={form.slug}
            onChange={(v) => setForm({ ...form, slug: v })}
            placeholder="auto-generated from name"
          />
          <div>
            <label className="text-xs font-medium text-ink-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-ink-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-between items-center gap-2 pt-2 border-t border-ink-100">
            {specialty ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete specialty "${specialty.name}"?`)) remove.mutate();
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
                {save.isPending ? "Saving…" : specialty ? "Save changes" : "Create specialty"}
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
