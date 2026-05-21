import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

export function KycReviewPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["kyc-queue"],
    queryFn: async () => (await api.get("/kyc/queue")).data,
  });
  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: string }) =>
      api.post(`/kyc/patients/${id}/verify`, { decision }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-queue"] }),
  });
  const items: any[] = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="KYC Review"
        subtitle={`${items.length} patient${items.length === 1 ? "" : "s"} pending verification`}
        icon={<ClipboardCheck size={20} />}
      />

      <Card>
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-ink-100 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={20} />}
            title="Queue is clear"
            description="Every patient is verified. Nice work."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((p: any) => (
              <li key={p.id} className="p-4 flex items-center gap-4 hover:bg-ink-50/60 transition">
                <Avatar name={p.full_name_en} size="md" />
                <div className="flex-1 min-w-0">
                  <Link to={`/patients/${p.id}`} className="font-medium text-ink-800 hover:text-brand-700">
                    {p.full_name_en}
                  </Link>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {p.code} · {p.phone || "no phone"} · {p.national_id || "no ID"}
                  </div>
                </div>
                <Badge tone={statusTone(p.kyc_status)} dot>
                  {p.kyc_status.replaceAll("_", " ")}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => decide.mutate({ id: p.id, decision: "verified" })}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 text-xs font-medium transition"
                  >
                    <CheckCircle2 size={12} /> Verify
                  </button>
                  <button
                    onClick={() => decide.mutate({ id: p.id, decision: "rejected" })}
                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 text-xs font-medium transition"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
