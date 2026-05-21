import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, X } from "lucide-react";

import { api } from "../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  entityKind: "doctor" | "patient";
  entityId: number;
  entityName: string;
  currentTenantId?: number | null;
  onSuccess?: () => void;
}

export function MoveTenantDialog({
  open, onClose, entityKind, entityId, entityName, currentTenantId, onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tenants = useQuery({
    queryKey: ["tenants-pick"],
    queryFn: async () => (await api.get("/tenants/")).data,
    enabled: open,
  });

  const move = useMutation({
    mutationFn: async () =>
      api.post(`/${entityKind === "doctor" ? "doctors" : "patients"}/${entityId}/move-tenant`, {
        tenant_id: target,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      onSuccess?.();
      onClose();
    },
    onError: (e: any) =>
      setError(e.response?.data?.error?.message || "Failed to move tenant"),
  });

  if (!open) return null;

  const list = ((tenants.data?.data || []) as any[]).filter((t) => t.id !== currentTenantId);

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <Building2 size={16} /> Move to another tenant
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-ink-600">
            Move <span className="font-semibold text-ink-800">{entityName}</span> to a different tenant.
            All related {entityKind === "doctor" ? "appointments" : "appointments + KYC + insurance"} will follow.
          </p>

          {list.length === 0 ? (
            <p className="text-sm text-ink-500 italic">
              No other tenants available. Create one in the Tenants page first.
            </p>
          ) : (
            <div className="space-y-1">
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTarget(t.id)}
                  className={`w-full text-left rounded-lg border p-3 flex items-center gap-3 transition ${
                    target === t.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-ink-200 hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <Building2 size={16} className="text-ink-500" />
                  <div className="flex-1">
                    <div className="font-medium text-ink-800">{t.name}</div>
                    <div className="text-xs text-ink-500 font-mono">{t.slug}</div>
                  </div>
                  {target === t.id && <ArrowRight size={14} className="text-brand-600" />}
                </button>
              ))}
            </div>
          )}

          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
            <button onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">Cancel</button>
            <button
              onClick={() => target && move.mutate()}
              disabled={!target || move.isPending}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
            >
              <ArrowRight size={14} /> {move.isPending ? "Moving…" : "Move"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
