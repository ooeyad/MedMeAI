import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Beaker, DollarSign, FlaskConical, Pencil, Pill, Plus, Search, Stethoscope, Tag, Upload, Wrench, X } from "lucide-react";

import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { BulkImportModal, ColumnSpec } from "../components/BulkImportModal";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";

const ITEM_IMPORT_COLUMNS: ColumnSpec[] = [
  { key: "name", header: "Name", required: true, aliases: ["item", "item name", "product"] },
  { key: "sku", header: "SKU", aliases: ["code"], hint: "Auto-generated if blank" },
  { key: "name_ar", header: "Name (Arabic)", aliases: ["arabic name", "name ar"] },
  { key: "kind", header: "Kind", aliases: ["type", "category"], hint: "consultation, medication, lab_test, imaging, procedure, supply, other" },
  { key: "default_price", header: "Price", aliases: ["default price", "amount", "cost"] },
  { key: "tax_rate_percent", header: "Tax %", aliases: ["tax", "tax percent"] },
  { key: "unit", header: "Unit", aliases: ["uom"] },
  { key: "description", header: "Description", aliases: ["notes"] },
  { key: "is_active", header: "Active", aliases: ["enabled"] },
];

interface Item {
  id: number;
  sku: string;
  name: string;
  name_ar?: string;
  kind: string;
  default_price: number;
  tax_rate_percent: number;
  is_active: boolean;
  is_taxable: boolean;
  unit?: string;
  category?: { id: number; name: string };
}

const KIND_TONE: Record<string, "brand" | "violet" | "amber" | "success" | "info" | "neutral"> = {
  consultation: "brand",
  medication: "info",
  lab_test: "violet",
  imaging: "amber",
  procedure: "success",
  supply: "neutral",
  other: "neutral",
};

const KIND_META: Record<
  string,
  { title: string; subtitle: string; icon: React.ReactNode; addLabel: string; emptyDesc: string }
> = {
  medication: {
    title: "Medications",
    subtitle: "Prescription catalog — shown as quick-picks in the consultation prescription form",
    icon: <Pill size={20} />,
    addLabel: "New medication",
    emptyDesc: "Add medications doctors prescribe most often so they show as quick-picks during consultations.",
  },
  lab_test: {
    title: "Laboratory tests",
    subtitle: "Lab catalog — shown as quick-picks under Lab tests in consultations",
    icon: <FlaskConical size={20} />,
    addLabel: "New lab test",
    emptyDesc: "Add tests your lab runs (CBC, HbA1c, lipid panel, …) so doctors can order them in one click.",
  },
  imaging: {
    title: "Imaging studies",
    subtitle: "Radiology catalog — shown as quick-picks under Imaging & procedures",
    icon: <Beaker size={20} />,
    addLabel: "New imaging study",
    emptyDesc: "Add X-ray, ultrasound, CT, MRI and other imaging studies you offer.",
  },
  procedure: {
    title: "Procedures",
    subtitle: "Procedural catalog — shown as quick-picks under Imaging & procedures",
    icon: <Wrench size={20} />,
    addLabel: "New procedure",
    emptyDesc: "Add wound dressings, injections, minor surgical procedures, ECG, etc.",
  },
  consultation: {
    title: "Consultation fees",
    subtitle: "Consultation pricing — used to auto-create invoices when an appointment completes",
    icon: <Stethoscope size={20} />,
    addLabel: "New consultation fee",
    emptyDesc: "Add general, specialist, and follow-up consultation fees.",
  },
};

export function PriceListPage() {
  const [params, setParams] = useSearchParams();
  const urlKind = params.get("kind") || "";
  const [q, setQ] = useState("");
  const [kind, setKind] = useState(urlKind);
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const canEdit = hasPermission("users:write");
  const qc = useQueryClient();

  // Keep URL ?kind=… in sync with the dropdown so deep-links from the sidebar work.
  useEffect(() => { setKind(urlKind); }, [urlKind]);

  function selectKind(newKind: string) {
    setKind(newKind);
    if (newKind) setParams({ kind: newKind }, { replace: true });
    else setParams({}, { replace: true });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["items", q, kind],
    queryFn: async () =>
      (await api.get("/billing/items", { params: { q, kind: kind || undefined, page_size: 200 } })).data,
  });
  const items: Item[] = data?.data || [];

  const meta = KIND_META[kind];
  const pageTitle = meta?.title || "Price list";
  const pageSubtitle = meta?.subtitle || `${data?.meta?.total ?? 0} items across your full catalog`;
  const pageIcon = meta?.icon || <DollarSign size={20} />;
  const newButtonLabel = meta?.addLabel || "New item";

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        icon={pageIcon}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or SKU"
                className="pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-56"
              />
            </div>
            <select
              value={kind}
              onChange={(e) => selectKind(e.target.value)}
              className="h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">All kinds</option>
              {Object.keys(KIND_TONE).map((k) => (
                <option key={k} value={k}>{k.replaceAll("_", " ")}</option>
              ))}
            </select>
            {canEdit && (
              <button
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 text-sm rounded-lg px-3 py-2"
              >
                <Upload size={14} /> Import
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft"
              >
                <Plus size={14} /> {newButtonLabel}
              </button>
            )}
          </>
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
        ) : items.length === 0 ? (
          <EmptyState
            icon={meta?.icon || <Tag size={20} />}
            title={meta ? `No ${meta.title.toLowerCase()} yet` : "No items in this catalog yet"}
            description={meta?.emptyDesc || "Add consultation fees, medications, lab tests, imaging and procedures."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3">SKU</th>
                  <th>Item</th>
                  <th>Kind</th>
                  <th>Unit</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Tax %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-ink-50/60 transition">
                    <td className="px-5 py-2 font-mono text-[11px] text-ink-500">{it.sku}</td>
                    <td className="py-2">
                      <div className="font-medium text-ink-800">{it.name}</div>
                      {it.name_ar && <div className="text-xs text-ink-500">{it.name_ar}</div>}
                    </td>
                    <td className="py-2">
                      <Badge tone={KIND_TONE[it.kind] || "neutral"}>{it.kind.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="py-2 text-ink-600">{it.unit || "—"}</td>
                    <td className="py-2 text-right font-medium text-ink-800 tabular-nums">{it.default_price.toFixed(2)}</td>
                    <td className="py-2 text-right text-ink-600 tabular-nums">{it.tax_rate_percent.toFixed(2)}</td>
                    <td className="px-5 py-2 text-right">
                      {canEdit && (
                        <button onClick={() => setEditing(it)} className="text-xs text-brand-700 hover:text-brand-900 inline-flex items-center gap-1">
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
        <ItemModal
          item={editing}
          defaultKind={kind || "consultation"}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <BulkImportModal
        open={importing}
        onClose={() => setImporting(false)}
        title={kind ? `Import ${meta?.title?.toLowerCase() || "items"} from Excel/CSV` : "Import items from Excel/CSV"}
        entityLabel={kind === "medication" ? "medication" : kind === "lab_test" ? "lab test" : kind === "imaging" ? "imaging study" : kind === "procedure" ? "procedure" : kind === "consultation" ? "consultation fee" : "item"}
        columns={ITEM_IMPORT_COLUMNS}
        endpoint="/billing/items/bulk-import"
        extraPayload={kind ? { kind } : undefined}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["items"] })}
      />
    </div>
  );
}

function ItemModal({ item, defaultKind, onClose }: { item: Item | null; defaultKind: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    sku: item?.sku || "",
    name: item?.name || "",
    name_ar: item?.name_ar || "",
    kind: item?.kind || defaultKind,
    default_price: item?.default_price ?? 0,
    tax_rate_percent: item?.tax_rate_percent ?? 0,
    unit: item?.unit || "",
    is_active: item?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        default_price: Number(form.default_price) || 0,
        tax_rate_percent: Number(form.tax_rate_percent) || 0,
      };
      if (item) return (await api.patch(`/billing/items/${item.id}`, payload)).data;
      return (await api.post("/billing/items", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to save item"),
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
            <Tag size={16} /> {item ? "Edit item" : "New item"}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU *" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} required />
            <div>
              <label className="text-xs font-medium text-ink-700">Kind *</label>
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
              >
                {Object.keys(KIND_TONE).map((k) => (
                  <option key={k} value={k}>{k.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Name (Arabic)" value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} />
            <Field label="Default price *" type="number" value={form.default_price} onChange={(v) => setForm({ ...form, default_price: v })} required />
            <Field label="Tax %" type="number" value={form.tax_rate_percent} onChange={(v) => setForm({ ...form, tax_rate_percent: v })} />
            <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="visit, tab, test…" />
          </div>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">Cancel</button>
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
            >
              {save.isPending ? "Saving…" : item ? "Save changes" : "Create item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, required, type,
}: {
  label: string; value: any; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-ink-700">{label}</label>
      <input
        value={value ?? ""}
        type={type || "text"}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </div>
  );
}
