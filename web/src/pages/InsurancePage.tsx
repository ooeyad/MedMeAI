import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

export function InsurancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get("/insurance/companies")).data,
  });
  const items: any[] = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Insurance"
        subtitle="Companies accepted across your clinic network"
        icon={<ShieldCheck size={20} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardBody>
              <div className="h-12 bg-ink-100 rounded animate-pulse" />
            </CardBody>
          </Card>
        ))}

        {!isLoading && items.length === 0 && (
          <div className="col-span-full">
            <Card>
              <EmptyState
                icon={<ShieldCheck size={20} />}
                title="No insurance companies yet"
                description="Once the seed runs you'll see network coverage here."
              />
            </Card>
          </div>
        )}

        {items.map((c) => (
          <Card key={c.id} hover>
            <CardBody>
              <div className="flex items-start gap-3">
                <Avatar name={c.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-ink-800 leading-tight">{c.name}</h3>
                    <Badge tone={c.active ? "success" : "neutral"} dot pulse={c.active}>
                      {c.active ? "active" : "inactive"}
                    </Badge>
                  </div>
                  {c.name_ar && <div className="text-xs text-ink-500 mt-0.5">{c.name_ar}</div>}
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-ink-500 bg-ink-50 px-2 py-1 rounded">
                    <ShieldCheck size={11} /> {c.code}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="How insurance works in MedMeAI"
          description="Per-patient plans are linked to one of these companies"
          icon={<ShieldCheck size={16} />}
        />
        <CardBody>
          <ul className="text-sm text-ink-600 space-y-2">
            <li className="flex gap-2"><span className="text-brand-500">●</span> Patients upload their card; OCR extracts policy + member numbers automatically.</li>
            <li className="flex gap-2"><span className="text-brand-500">●</span> Booking checks the doctor's accepted networks and flags appointments that need pre-approval.</li>
            <li className="flex gap-2"><span className="text-brand-500">●</span> Officers approve from the queue; status flows back to the patient via in-app + push notifications.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
