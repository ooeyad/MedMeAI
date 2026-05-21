import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { hasPermission, useAuthStore } from "../store/auth";

interface Overview {
  total_appointments: number;
  appointments_last_30_days: number;
  appointments_by_status: Record<string, number>;
  no_show_rate: number;
  cancellation_rate: number;
  insurance_pending_approvals: number;
  new_patients_last_30_days: number;
  kyc_breakdown: Record<string, number>;
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isPatient = (user?.roles || []).includes("patient");
  if (isPatient) return <PatientDashboard />;
  return <ClinicDashboard />;
}

function ClinicDashboard() {
  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["overview"],
    queryFn: async () => (await api.get("/reports/overview")).data,
  });

  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-8 shadow-card">
        <div className="absolute -right-12 -top-12 size-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-10 bottom-0 opacity-10 pointer-events-none">
          <HeartPulse size={160} strokeWidth={1.4} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-brand-100 text-xs uppercase tracking-wider font-semibold">
            <Sparkles size={14} /> Today at a glance
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 text-brand-50 text-sm max-w-xl">
            Here's what's happening across your clinic right now. Use the AI assistant for instant
            answers, or jump straight to today's schedule.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/appointments/book"
              className="inline-flex items-center gap-2 bg-white text-brand-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition shadow-soft"
            >
              <CalendarDays size={14} /> Book appointment
            </Link>
            <Link
              to="/ai"
              className="inline-flex items-center gap-2 bg-white/15 text-white ring-1 ring-white/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/25 transition backdrop-blur"
            >
              <Sparkles size={14} /> Ask AI assistant
            </Link>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total appointments"
          value={isLoading ? "—" : data?.total_appointments ?? 0}
          icon={<CalendarDays size={18} />}
          accent="brand"
          hint="all-time"
        />
        <StatCard
          label="Last 30 days"
          value={isLoading ? "—" : data?.appointments_last_30_days ?? 0}
          icon={<TrendingUp size={18} />}
          accent="sky"
          hint="appointments booked"
        />
        <StatCard
          label="No-show rate"
          value={isLoading ? "—" : `${((data?.no_show_rate || 0) * 100).toFixed(1)}%`}
          icon={<AlertTriangle size={18} />}
          accent="amber"
        />
        <StatCard
          label="Insurance pending"
          value={isLoading ? "—" : data?.insurance_pending_approvals ?? 0}
          icon={<ShieldCheck size={18} />}
          accent="violet"
          hint="awaiting approval"
        />
      </div>

      {/* Two-column breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Appointments by status"
            description="Live distribution across the lifecycle"
            icon={<CalendarDays size={16} />}
            action={
              <Link
                to="/appointments"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Open all <ArrowUpRight size={12} />
              </Link>
            }
          />
          <CardBody>
            {isLoading ? (
              <Skeleton />
            ) : Object.keys(data?.appointments_by_status || {}).length === 0 ? (
              <p className="py-6 text-sm text-ink-500">No appointment activity yet.</p>
            ) : (
              <StatusBars items={data!.appointments_by_status} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="KYC funnel"
            description={`${data?.new_patients_last_30_days ?? 0} new patients in 30 days`}
            icon={<ClipboardCheck size={16} />}
          />
          <CardBody>
            {isLoading ? (
              <Skeleton />
            ) : (
              <ul className="space-y-2.5 text-sm">
                {Object.entries(data?.kyc_breakdown || {}).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between">
                    <Badge tone={statusTone(k)} dot>
                      {k.replaceAll("_", " ")}
                    </Badge>
                    <span className="font-semibold text-ink-800 tabular-nums">{v}</span>
                  </li>
                ))}
                {!Object.keys(data?.kyc_breakdown || {}).length && (
                  <li className="text-ink-500 py-2">No verifications yet.</li>
                )}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quick actions — only show what this role can use */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasPermission("patients:write") && (
          <QuickAction
            to="/patients"
            icon={<UserPlus size={18} />}
            title="New patient"
            description="Register a patient and start KYC."
          />
        )}
        {hasPermission("doctors:read") && (
          <QuickAction
            to="/doctors"
            icon={<Stethoscope size={18} />}
            title="Doctor directory"
            description="Schedules, specialties, networks."
          />
        )}
        {hasPermission("kyc:verify") && (
          <QuickAction
            to="/kyc"
            icon={<ClipboardCheck size={18} />}
            title="KYC review"
            description="Verify identity and insurance docs."
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Patient-focused dashboard
// ---------------------------------------------------------------------------
function PatientDashboard() {
  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "there";

  const apptsQuery = useQuery({
    queryKey: ["my-appointments"],
    queryFn: async () =>
      (await api.get("/appointments/", { params: { page_size: 10 } })).data,
  });

  const insuranceQuery = useQuery({
    queryKey: ["my-insurance", user?.patient_id],
    queryFn: async () =>
      (await api.get(`/insurance/patients/${user?.patient_id}`)).data,
    enabled: !!user?.patient_id,
  });

  const kycQuery = useQuery({
    queryKey: ["my-kyc", user?.patient_id],
    queryFn: async () =>
      (await api.get(`/kyc/patients/${user?.patient_id}`)).data,
    enabled: !!user?.patient_id,
  });

  const rawAppointments: any[] = apptsQuery.data?.data || [];
  const insurances: any[] = insuranceQuery.data?.data || [];
  const kycStatus: string = kycQuery.data?.status || "pending";

  // Only consider future appointments as "upcoming" — a confirmed slot from
  // yesterday is over, not next.
  const nowIso = new Date().toISOString();
  const upcoming = rawAppointments
    .filter((a) =>
      ["requested", "pending_confirmation", "confirmed", "checked_in", "waiting_insurance_approval"].includes(a.status)
      && a.starts_at >= nowIso,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const next = upcoming[0];

  // Display order: upcoming first (soonest at top), then past (most recent at top).
  const past = rawAppointments
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const appointments = [...upcoming, ...past];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-6 md:p-8 shadow-card">
        <div className="absolute -right-12 -top-12 size-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute right-10 bottom-0 opacity-10 pointer-events-none">
          <HeartPulse size={160} strokeWidth={1.4} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-2 text-brand-100 text-xs uppercase tracking-wider font-semibold">
            <Sparkles size={14} /> Your health, organised
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2 text-brand-50 text-sm max-w-xl">
            Manage appointments, upload your KYC documents, and check insurance — or ask the AI
            assistant for anything.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/appointments/book"
              className="inline-flex items-center gap-2 bg-white text-brand-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition shadow-soft"
            >
              <CalendarDays size={14} /> Book appointment
            </Link>
            <Link
              to="/ai"
              className="inline-flex items-center gap-2 bg-white/15 text-white ring-1 ring-white/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/25 transition backdrop-blur"
            >
              <Sparkles size={14} /> Ask AI assistant
            </Link>
          </div>
        </div>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PatientStatCard
          icon={<Clock size={18} />}
          accent="brand"
          label="Next appointment"
          value={next ? next.starts_at.slice(0, 16).replace("T", " ") : "—"}
          hint={next ? `${next.doctor?.user?.full_name || ""} · ${next.status.replaceAll("_", " ")}` : "Nothing scheduled"}
        />
        <PatientStatCard
          icon={<ClipboardCheck size={18} />}
          accent={kycStatus === "verified" ? "emerald" : "amber"}
          label="KYC status"
          value={kycStatus.replaceAll("_", " ")}
          hint={kycStatus === "verified" ? "All set" : "Upload documents to verify"}
        />
        <PatientStatCard
          icon={<ShieldCheck size={18} />}
          accent={insurances.length ? "violet" : "rose"}
          label="Insurance plans"
          value={String(insurances.length)}
          hint={insurances.length ? insurances[0]?.insurance_company_id ? `Primary on file` : "Linked" : "Add a plan"}
        />
      </div>

      {/* Upcoming + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="My appointments"
            description="Upcoming first, then most recent"
            icon={<CalendarDays size={16} />}
            action={
              <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                See all <ArrowUpRight size={12} />
              </Link>
            }
          />
          <CardBody>
            {apptsQuery.isLoading ? (
              <Skeleton />
            ) : appointments.length === 0 ? (
              <div className="text-sm text-ink-500 py-4">
                You don't have any appointments yet.{" "}
                <Link to="/appointments/book" className="text-brand-600 font-medium">
                  Book your first
                </Link>.
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {appointments.slice(0, 6).map((a) => (
                  <li key={a.id} className="py-3 flex items-center gap-3">
                    <Avatar name={a.doctor?.user?.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-800 truncate">
                        {a.doctor?.user?.full_name || "Doctor"}
                      </div>
                      <div className="text-xs text-ink-500">
                        {a.starts_at?.slice(0, 16).replace("T", " ")} · {a.code}
                      </div>
                    </div>
                    <Badge tone={statusTone(a.status)} dot pulse={a.status === "in_consultation"}>
                      {a.status.replaceAll("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick actions" icon={<Sparkles size={16} />} />
          <CardBody>
            <div className="space-y-2">
              <PatientAction to="/appointments/book" icon={<CalendarDays size={16} />} label="Book appointment" />
              <PatientAction to="/ai" icon={<Sparkles size={16} />} label="Ask AI assistant" />
              <PatientAction to="/profile" icon={<FileText size={16} />} label="My documents (KYC)" />
              <PatientAction to="/appointments" icon={<CheckCircle2 size={16} />} label="My appointments" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function PatientStatCard({
  icon,
  label,
  value,
  hint,
  accent = "brand",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "brand" | "emerald" | "amber" | "rose" | "violet";
}) {
  const accents: Record<string, string> = {
    brand: "from-brand-500 to-sky-500",
    emerald: "from-emerald-500 to-teal-600",
    amber: "from-amber-500 to-rose-500",
    rose: "from-rose-500 to-pink-600",
    violet: "from-violet-500 to-fuchsia-500",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift">
      <div
        className={`absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl ${accents[accent]}`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</div>
          <div className="mt-2 text-lg font-semibold text-ink-900 capitalize">{value}</div>
          {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
        </div>
        <div className={`size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft ${accents[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function PatientAction({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 transition group"
    >
      <span className="size-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100">
        {icon}
      </span>
      {label}
      <ArrowUpRight size={12} className="ml-auto text-ink-400 group-hover:text-brand-600" />
    </Link>
  );
}

function StatusBars({ items }: { items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const toneBg: Record<string, string> = {
    neutral: "bg-ink-400",
    brand: "bg-brand-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    amber: "bg-amber-500",
    danger: "bg-rose-500",
    info: "bg-sky-500",
    violet: "bg-violet-500",
  };
  return (
    <ul className="space-y-3">
      {entries.map(([k, v]) => {
        const tone = statusTone(k);
        return (
          <li key={k}>
            <div className="flex justify-between text-xs text-ink-600 mb-1">
              <span className="capitalize">{k.replaceAll("_", " ")}</span>
              <span className="font-semibold tabular-nums text-ink-800">{v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${toneBg[tone] || "bg-ink-400"}`}
                style={{ width: `${(v / max) * 100}%`, transition: "width 600ms ease" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QuickAction({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift block"
    >
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100 transition">
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-ink-800 text-sm">{title}</div>
          <div className="text-xs text-ink-500 mt-0.5">{description}</div>
        </div>
        <ArrowUpRight size={14} className="text-ink-400 group-hover:text-brand-600 transition" />
      </div>
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-3 bg-ink-100 rounded animate-pulse" />
      <div className="h-3 bg-ink-100 rounded animate-pulse w-5/6" />
      <div className="h-3 bg-ink-100 rounded animate-pulse w-3/4" />
    </div>
  );
}
