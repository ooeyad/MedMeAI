import { useQuery } from "@tanstack/react-query";
import { FileSearch, Globe } from "lucide-react";

import { api } from "../api/client";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

export function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await api.get("/audit/", { params: { page_size: 50 } })).data,
  });
  const items: any[] = data?.data || [];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Audit Log"
        subtitle="Every mutating action across the platform"
        icon={<FileSearch size={20} />}
      />
      <Card>
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-ink-100 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FileSearch size={20} />}
            title="No audit entries yet"
            description="Actions like booking, KYC verification, and AI tool calls land here."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((a) => (
              <li key={a.id} className="p-4 flex items-start gap-3 hover:bg-ink-50/60 transition">
                <div className="size-9 rounded-lg bg-ink-50 text-ink-500 grid place-items-center shrink-0">
                  <FileSearch size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-ink-500">
                      {a.at?.slice(0, 19).replace("T", " ")}
                    </span>
                    {a.source_channel && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                        <Globe size={9} /> {a.source_channel}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-ink-800">{a.action}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    user #{a.user_id} · {a.entity_type} #{a.entity_id}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
