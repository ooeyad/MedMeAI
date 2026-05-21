import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  Cake,
  Calendar,
  ClipboardCheck,
  Droplet,
  Mail,
  Pencil,
  Phone,
  Pill,
  ShieldAlert,
  User,
} from "lucide-react";

import { api } from "../api/client";
import { MoveTenantDialog } from "../components/MoveTenantDialog";
import { NewPatientModal } from "../components/NewPatientModal";
import { PatientInsuranceSection } from "../components/PatientInsuranceSection";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { hasPermission, useAuthStore } from "../store/auth";

export function PatientDetailPage() {
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const isSuper = (useAuthStore.getState().user?.roles || []).includes("super_admin");
  const canEdit = hasPermission("patients:write");

  const { data: patient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data,
    enabled: !!id,
  });
  const { data: timeline } = useQuery({
    queryKey: ["patient-timeline", id],
    queryFn: async () => (await api.get(`/patients/${id}/timeline`)).data,
    enabled: !!id,
  });
  const { data: kyc } = useQuery({
    queryKey: ["patient-kyc", id],
    queryFn: async () => (await api.get(`/kyc/patients/${id}`)).data,
    enabled: !!id,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700">
        <ArrowLeft size={12} /> Back to patients
      </Link>

      {/* Profile hero */}
      <Card>
        <CardBody>
          {!patient ? (
            <div className="h-24 bg-ink-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-start gap-5">
              <Avatar name={patient.full_name_en} size="xl" ring />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h1 className="text-xl font-semibold text-ink-900">{patient.full_name_en}</h1>
                    {patient.full_name_ar && (
                      <div className="text-sm text-ink-500 mt-0.5">{patient.full_name_ar}</div>
                    )}
                    <div className="mt-1 text-xs font-mono text-ink-500">{patient.code}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={statusTone(patient.kyc_status)} dot pulse={patient.kyc_status === "verified"}>
                      KYC {patient.kyc_status}
                    </Badge>
                    {canEdit && (
                      <button
                        onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium px-2.5 py-1 transition"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    {isSuper && (
                      <button
                        onClick={() => setMoveOpen(true)}
                        className="inline-flex items-center gap-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium px-2.5 py-1 transition"
                      >
                        <ArrowRightLeft size={12} /> Move tenant
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Detail icon={<Phone size={12} />} label="Phone" value={patient.phone} />
                  <Detail icon={<Mail size={12} />} label="Email" value={patient.email} />
                  <Detail icon={<User size={12} />} label="National ID" value={patient.national_id} mono />
                  <Detail icon={<Cake size={12} />} label="DOB" value={patient.date_of_birth} />
                  <Detail icon={<User size={12} />} label="Gender" value={patient.gender} />
                  <Detail icon={<Droplet size={12} />} label="Blood type" value={patient.blood_type} />
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medical */}
        <Card>
          <CardHeader title="Medical profile" icon={<Pill size={16} />} />
          <CardBody>
            {patient ? (
              <div className="space-y-3 text-sm">
                <TagGroup
                  icon={<ShieldAlert size={12} className="text-rose-600" />}
                  label="Allergies"
                  items={patient.allergies}
                  tone="bg-rose-50 text-rose-700 ring-rose-200"
                />
                <TagGroup
                  icon={<ShieldAlert size={12} className="text-amber-600" />}
                  label="Chronic"
                  items={patient.chronic_diseases}
                  tone="bg-amber-50 text-amber-700 ring-amber-200"
                />
                <TagGroup
                  icon={<Pill size={12} className="text-brand-600" />}
                  label="Medications"
                  items={patient.current_medications}
                  tone="bg-brand-50 text-brand-700 ring-brand-200"
                />
                {patient.medical_history_summary && (
                  <div className="mt-3 pt-3 border-t border-ink-100">
                    <div className="text-xs font-semibold text-ink-700 mb-1">History summary</div>
                    <p className="text-ink-600">{patient.medical_history_summary}</p>
                  </div>
                )}
              </div>
            ) : <SkelLine />}
          </CardBody>
        </Card>

        {/* KYC */}
        <Card>
          <CardHeader title="KYC" icon={<ClipboardCheck size={16} />} />
          <CardBody>
            {kyc ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(kyc.status || "pending")} dot>
                    {kyc.status || "pending"}
                  </Badge>
                  {kyc.reviewed_at && (
                    <span className="text-xs text-ink-500">
                      Reviewed {kyc.reviewed_at.slice(0, 16).replace("T", " ")}
                    </span>
                  )}
                </div>
                {kyc.extracted_payload && (
                  <pre className="text-[11px] bg-ink-50 border border-ink-100 rounded-lg p-3 overflow-auto max-h-48 font-mono text-ink-700">
                    {JSON.stringify(kyc.extracted_payload, null, 2)}
                  </pre>
                )}
              </div>
            ) : <SkelLine />}
          </CardBody>
        </Card>
      </div>

      {/* Insurance */}
      {id && <PatientInsuranceSection patientId={Number(id)} />}

      {/* Timeline */}
      <Card>
        <CardHeader title="Timeline" icon={<Calendar size={16} />} description="Appointments and KYC events" />
        <CardBody>
          {timeline ? (
            <ol className="relative border-l-2 border-ink-100 ml-3 space-y-4">
              {(timeline.events || []).map((e: any, i: number) => (
                <li key={i} className="ml-4 pl-2">
                  <div className="absolute -left-[7px] size-3 rounded-full bg-brand-500 ring-2 ring-white" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-ink-800 font-medium">
                        {e.kind === "appointment" ? `Appointment ${e.code || ""}` : `KYC ${e.status}`}
                      </div>
                      <div className="text-xs text-ink-500 font-mono">
                        {e.at?.slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                    {e.status && <Badge tone={statusTone(e.status)}>{e.status.replaceAll("_", " ")}</Badge>}
                  </div>
                </li>
              ))}
              {!(timeline.events || []).length && (
                <li className="ml-4 text-sm text-ink-500">No activity yet.</li>
              )}
            </ol>
          ) : <SkelLine />}
        </CardBody>
      </Card>

      {/* Edit + Move dialogs */}
      {patient && (
        <NewPatientModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          existing={patient}
        />
      )}
      {patient && (
        <MoveTenantDialog
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          entityKind="patient"
          entityId={patient.id}
          entityName={patient.full_name_en || patient.code}
          currentTenantId={patient.tenant_id}
        />
      )}
    </div>
  );
}

function Detail({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-500 uppercase tracking-wider flex items-center gap-1">
        <span className="text-ink-400">{icon}</span>{label}
      </div>
      <div className={`mt-0.5 text-ink-800 font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function TagGroup({
  icon,
  label,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  items?: string[];
  tone: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-700 flex items-center gap-1 mb-1">
        {icon} {label}
      </div>
      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item} className={`text-xs px-2 py-0.5 rounded-full ring-1 ring-inset ${tone}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-ink-400">None</div>
      )}
    </div>
  );
}

const SkelLine = () => <div className="h-16 bg-ink-100 rounded animate-pulse" />;
