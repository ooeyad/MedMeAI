import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileText, Receipt, Search } from "lucide-react";

import { api } from "../api/client";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

const STATUS_TONES: Record<string, "info" | "success" | "warning" | "danger" | "neutral" | "amber"> = {
  draft: "neutral",
  open: "info",
  paid: "success",
  partial: "warning",
  void: "neutral",
  refunded: "danger",
};

export function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", status],
    queryFn: async () =>
      (await api.get("/billing/invoices", {
        params: { status: status || undefined, page_size: 100 },
      })).data,
  });

  const items: any[] = data?.data || [];
  const filtered = q
    ? items.filter((inv) => (inv.code || "").toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Invoices"
        subtitle={`${data?.meta?.total ?? 0} invoices in your tenant`}
        icon={<Receipt size={20} />}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Invoice code"
                className="pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-56"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">All statuses</option>
              {Object.keys(STATUS_TONES).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </>
        }
      />

      <Card>
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-ink-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="No invoices yet"
            description="Complete an appointment to auto-generate the first invoice."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                  <th className="px-5 py-3">Code</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Insurance</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-ink-50/60 transition">
                    <td className="px-5 py-2 font-mono text-xs">{inv.code}</td>
                    <td className="py-2">
                      <Badge tone={STATUS_TONES[inv.status] || "neutral"} dot>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-2 font-mono text-xs text-ink-500">
                      {inv.issued_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-2 text-right font-medium text-ink-800 tabular-nums">
                      {Number(inv.total).toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-2 text-right text-emerald-700 tabular-nums">
                      {Number(inv.paid_total).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-rose-700 tabular-nums">
                      {Number(inv.balance).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-ink-600 tabular-nums">
                      {Number(inv.insurance_share).toFixed(2)}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-brand-600 hover:text-brand-700 text-xs font-medium inline-flex items-center gap-1"
                      >
                        Open <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
