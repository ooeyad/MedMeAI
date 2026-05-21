import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Banknote, CheckCircle2, CreditCard, Plus, Receipt,
  ShieldCheck, Trash2, X, XCircle,
} from "lucide-react";

import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";

const STATUS_TONES: Record<string, "info" | "success" | "warning" | "danger" | "neutral" | "amber"> = {
  draft: "neutral", open: "info", paid: "success", partial: "warning", void: "neutral", refunded: "danger",
};

export function InvoiceDetailPage() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const qc = useQueryClient();
  const [showAddLine, setShowAddLine] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  const inv = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => (await api.get(`/billing/invoices/${invoiceId}`)).data,
    enabled: !!invoiceId,
  });
  const patient = useQuery({
    queryKey: ["invoice-patient", inv.data?.patient_id],
    queryFn: async () => (await api.get(`/patients/${inv.data?.patient_id}`)).data,
    enabled: !!inv.data?.patient_id,
  });

  const removeLine = useMutation({
    mutationFn: async (lineId: number) => api.delete(`/billing/invoices/${invoiceId}/lines/${lineId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
  });
  const voidInv = useMutation({
    mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/void`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] }),
  });

  if (!inv.data) {
    return <div className="max-w-5xl mx-auto p-8 text-ink-500">Loading…</div>;
  }
  const i = inv.data;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <Link to="/invoices" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700">
        <ArrowLeft size={12} /> Back to invoices
      </Link>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-ink-900 font-mono">{i.code}</h1>
                <Badge tone={STATUS_TONES[i.status] || "neutral"} dot pulse={i.status === "open"}>{i.status}</Badge>
              </div>
              <div className="text-sm text-ink-500 mt-1">
                Patient:{" "}
                {patient.data ? (
                  <Link to={`/patients/${patient.data.id}`} className="text-brand-700 hover:underline">
                    {patient.data.full_name_en}
                  </Link>
                ) : "…"}
                {i.issued_at && <> · Issued {i.issued_at.slice(0, 16).replace("T", " ")}</>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {i.status !== "void" && i.status !== "paid" && (
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-3 py-2 shadow-soft"
                >
                  <Banknote size={14} /> Record payment
                </button>
              )}
              {i.status !== "void" && (
                <button
                  onClick={() => confirm("Void this invoice?") && voidInv.mutate()}
                  className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm rounded-lg px-3 py-2"
                >
                  <XCircle size={14} /> Void
                </button>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Total label="Subtotal" value={i.subtotal} currency={i.currency} />
            <Total label="Tax" value={i.tax_total} currency={i.currency} />
            <Total label="Total" value={i.total} currency={i.currency} accent="brand" />
            <Total label="Balance" value={i.balance} currency={i.currency} accent={Number(i.balance) > 0 ? "rose" : "emerald"} />
            <Total label="Patient share" value={i.patient_share} currency={i.currency} />
            <Total label="Insurance share" value={i.insurance_share} currency={i.currency} icon={<ShieldCheck size={12} />} />
            <Total label="Paid" value={i.paid_total} currency={i.currency} accent="emerald" icon={<CheckCircle2 size={12} />} />
          </div>
        </CardBody>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader
          title="Line items"
          icon={<Receipt size={16} />}
          description={`${i.lines?.length || 0} line${(i.lines?.length || 0) === 1 ? "" : "s"}`}
          action={
            i.status !== "void" && (
              <button
                onClick={() => setShowAddLine(true)}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-1.5 shadow-soft"
              >
                <Plus size={14} /> Add line
              </button>
            )
          }
        />
        <CardBody>
          {(i.lines || []).length === 0 ? (
            <p className="text-sm text-ink-500 py-3">No line items yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  <th className="py-2">Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Discount %</th>
                  <th className="text-right">Tax %</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {(i.lines || []).map((l: any) => (
                  <tr key={l.id}>
                    <td className="py-2 text-ink-800">{l.description}</td>
                    <td className="py-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="py-2 text-right tabular-nums">{Number(l.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{Number(l.discount_percent).toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{Number(l.tax_rate_percent).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{Number(l.line_total).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {i.status !== "void" && (
                        <button
                          onClick={() => removeLine.mutate(l.id)}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader
          title="Payments"
          icon={<CreditCard size={16} />}
          description={`${i.payments?.length || 0} payment${(i.payments?.length || 0) === 1 ? "" : "s"}`}
        />
        <CardBody>
          {(i.payments || []).length === 0 ? (
            <p className="text-sm text-ink-500 py-3">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {(i.payments || []).map((p: any) => (
                <li key={p.id} className="py-2 flex items-center gap-3 text-sm">
                  <Badge tone="info">{p.method.replaceAll("_", " ")}</Badge>
                  <span className="text-ink-600">{p.paid_at?.slice(0, 16).replace("T", " ")}</span>
                  {p.reference && <span className="font-mono text-xs text-ink-500">ref {p.reference}</span>}
                  <span className="flex-1" />
                  <span className="font-medium text-ink-800 tabular-nums">{Number(p.amount).toFixed(2)} {p.currency}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {showAddLine && <AddLineModal invoiceId={invoiceId} onClose={() => setShowAddLine(false)} />}
      {showAddPayment && <AddPaymentModal invoiceId={invoiceId} balance={Number(i.balance)} onClose={() => setShowAddPayment(false)} />}
    </div>
  );
}

function Total({
  label, value, currency, accent, icon,
}: {
  label: string; value: number; currency: string;
  accent?: "brand" | "emerald" | "rose";
  icon?: React.ReactNode;
}) {
  const color = accent === "emerald" ? "text-emerald-700"
    : accent === "rose" ? "text-rose-700"
    : accent === "brand" ? "text-brand-700"
    : "text-ink-800";
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <div className="text-[11px] text-ink-500 uppercase tracking-wider flex items-center gap-1">{icon}{label}</div>
      <div className={`mt-0.5 font-semibold tabular-nums ${color}`}>{Number(value).toFixed(2)} {currency}</div>
    </div>
  );
}

function AddLineModal({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["items-pick"],
    queryFn: async () => (await api.get("/billing/items", { params: { page_size: 200 } })).data,
  });

  const [form, setForm] = useState<any>({
    item_id: "", description: "", quantity: 1, unit_price: 0, discount_percent: 0, tax_rate_percent: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/lines`, {
      item_id: form.item_id ? Number(form.item_id) : undefined,
      description: form.description,
      quantity: Number(form.quantity) || 1,
      unit_price: Number(form.unit_price) || 0,
      discount_percent: Number(form.discount_percent) || 0,
      tax_rate_percent: Number(form.tax_rate_percent) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to add line"),
  });

  function pickItem(id: string) {
    const item = (items.data?.data || []).find((i: any) => String(i.id) === id);
    setForm({
      ...form,
      item_id: id,
      description: item?.name || form.description,
      unit_price: item?.default_price ?? form.unit_price,
      tax_rate_percent: item?.tax_rate_percent ?? form.tax_rate_percent,
    });
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold"><Plus size={16} /> Add line</div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-700">Item (optional — auto-fills price)</label>
            <select
              value={form.item_id}
              onChange={(e) => pickItem(e.target.value)}
              className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            >
              <option value="">— ad-hoc —</option>
              {(items.data?.data || []).map((it: any) => (
                <option key={it.id} value={it.id}>{it.name} · {Number(it.default_price).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <Field label="Description *" value={form.description} onChange={(v) => setForm({ ...form, description: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <Field label="Unit price" type="number" value={form.unit_price} onChange={(v) => setForm({ ...form, unit_price: v })} />
            <Field label="Discount %" type="number" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: v })} />
            <Field label="Tax %" type="number" value={form.tax_rate_percent} onChange={(v) => setForm({ ...form, tax_rate_percent: v })} />
          </div>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">Cancel</button>
            <button type="submit" disabled={save.isPending} className="bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft inline-flex items-center gap-1.5">
              <Plus size={14} /> {save.isPending ? "Adding…" : "Add line"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddPaymentModal({ invoiceId, balance, onClose }: { invoiceId: number; balance: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    method: "cash", amount: balance, reference: "", notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => api.post(`/billing/invoices/${invoiceId}/payments`, {
      ...form,
      amount: Number(form.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to record payment"),
  });

  function onSubmit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold"><Banknote size={16} /> Record payment</div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-700">Method *</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="mt-1 w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="insurance">Insurance</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Field label="Amount *" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          <Field label="Reference (card auth / cheque #)" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} />
          <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">Cancel</button>
            <button type="submit" disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft inline-flex items-center gap-1.5">
              <Banknote size={14} /> {save.isPending ? "Recording…" : "Record"}
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
