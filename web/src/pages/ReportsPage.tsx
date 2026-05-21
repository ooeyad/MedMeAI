import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardCheck, Stethoscope } from "lucide-react";

import { api } from "../api/client";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

export function ReportsPage() {
  const utilization = useQuery({
    queryKey: ["doctor-utilization"],
    queryFn: async () => (await api.get("/reports/doctor-utilization")).data,
  });
  const kyc = useQuery({
    queryKey: ["kyc-funnel"],
    queryFn: async () => (await api.get("/reports/kyc-funnel")).data,
  });

  const util = utilization.data?.data || [];
  const maxAppts = Math.max(...util.map((d: any) => d.appointments || 0), 1);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Aggregates and trends across your clinic"
        icon={<Activity size={20} />}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Doctor utilization"
            description="Last 30 days · appointments by doctor"
            icon={<Stethoscope size={16} />}
          />
          <CardBody>
            {utilization.isLoading ? (
              <div className="h-32 bg-ink-100 rounded animate-pulse" />
            ) : util.length === 0 ? (
              <p className="text-sm text-ink-500">No utilization data yet.</p>
            ) : (
              <ul className="space-y-3">
                {util.map((d: any) => (
                  <li key={d.doctor_id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-800 font-medium">{d.doctor_name}</span>
                      <span className="text-ink-500 tabular-nums">
                        {d.appointments} appt · {Math.round((d.total_seconds || 0) / 3600 * 10) / 10}h
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-sky-500"
                        style={{ width: `${(d.appointments / maxAppts) * 100}%`, transition: "width 600ms ease" }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="KYC funnel"
            description="Verification states across all patients"
            icon={<ClipboardCheck size={16} />}
          />
          <CardBody>
            {kyc.isLoading ? (
              <div className="h-32 bg-ink-100 rounded animate-pulse" />
            ) : (
              <ul className="space-y-2.5 text-sm">
                {Object.entries(kyc.data || {}).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between">
                    <Badge tone={statusTone(k)} dot>{k.replaceAll("_", " ")}</Badge>
                    <span className="font-semibold text-ink-800 tabular-nums">{v as any}</span>
                  </li>
                ))}
                {!Object.keys(kyc.data || {}).length && (
                  <li className="text-ink-500 py-2">No verifications yet.</li>
                )}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
