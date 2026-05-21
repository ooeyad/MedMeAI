import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HeartPulse,
  Play,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuthStore } from "../store/auth";

interface Appointment {
  id: number;
  code: string;
  status: string;
  starts_at: string;
  reason?: string;
  patient?: { id: number; code: string; full_name_en: string; phone?: string };
}

const COLUMNS: {
  key: string;
  title: string;
  statuses: string[];
  tone: "info" | "warning" | "brand" | "success";
  icon: React.ReactNode;
}[] = [
  { key: "checked_in", title: "Checked in", statuses: ["checked_in"], tone: "warning", icon: <UserCheck size={14} /> },
  { key: "in_consultation", title: "In consultation", statuses: ["in_consultation"], tone: "brand", icon: <Stethoscope size={14} /> },
  { key: "scheduled", title: "Scheduled today", statuses: ["requested", "pending_confirmation", "confirmed"], tone: "info", icon: <Clock size={14} /> },
  { key: "completed", title: "Completed today", statuses: ["completed"], tone: "success", icon: <CheckCircle2 size={14} /> },
];

export function DoctorDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "Doctor";

  const qc = useQueryClient();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
  const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const endOfNext14 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14, 23, 59, 59).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-today"],
    queryFn: async () =>
      (await api.get("/appointments/", {
        params: { date_from: startOfDay, date_to: endOfDay, page_size: 100 },
      })).data,
  });

  const upcoming = useQuery({
    queryKey: ["doctor-upcoming"],
    queryFn: async () =>
      (await api.get("/appointments/", {
        params: { date_from: startOfTomorrow, date_to: endOfNext14, page_size: 200 },
      })).data,
  });

  const items: Appointment[] = data?.data || [];
  const buckets = COLUMNS.map((c) => ({
    ...c,
    items: items.filter((a) => c.statuses.includes(a.status)),
  }));

  const transition = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) =>
      api.post(`/appointments/${id}/${action}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-today"] });
      qc.invalidateQueries({ queryKey: ["doctor-upcoming"] });
    },
  });

  // Group upcoming by date (next 14 days, only active statuses)
  const upcomingItems: Appointment[] = (upcoming.data?.data || []).filter((a: Appointment) =>
    ["requested", "pending_confirmation", "confirmed", "waiting_insurance_approval"].includes(a.status),
  );
  const upcomingByDay: Record<string, Appointment[]> = {};
  upcomingItems
    .slice()
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .forEach((a) => {
      const day = a.starts_at.slice(0, 10);
      (upcomingByDay[day] ||= []).push(a);
    });

  // KPIs
  const total = items.length;
  const completed = buckets.find((b) => b.key === "completed")!.items.length;
  const inCons = buckets.find((b) => b.key === "in_consultation")!.items.length;
  const waiting = buckets.find((b) => b.key === "checked_in")!.items.length;

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
            <Sparkles size={14} /> Today's clinic
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}, Dr. {firstName}
          </h1>
          <p className="mt-2 text-brand-50 text-sm max-w-xl">
            {waiting > 0
              ? `${waiting} patient${waiting === 1 ? " is" : "s are"} waiting for you.`
              : "No one waiting right now. Your next checked-in patient will appear here."}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<Users size={18} />} label="Total today" value={total} accent="brand" />
        <Kpi icon={<UserCheck size={18} />} label="Waiting" value={waiting} accent="amber" />
        <Kpi icon={<Stethoscope size={18} />} label="In consultation" value={inCons} accent="violet" />
        <Kpi icon={<CheckCircle2 size={18} />} label="Completed" value={completed} accent="emerald" />
      </div>

      {/* Queue board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {buckets.map((col) => (
          <Card key={col.key} className="flex flex-col">
            <CardHeader
              title={col.title}
              description={`${col.items.length} patient${col.items.length === 1 ? "" : "s"}`}
              icon={col.icon}
            />
            <CardBody className="flex-1 space-y-2 max-h-[60vh] overflow-auto scrollbar-thin">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-ink-100 animate-pulse" />
                ))
              ) : col.items.length === 0 ? (
                <p className="text-xs text-ink-500 py-4 text-center">Nothing here.</p>
              ) : (
                col.items.map((a) => (
                  <QueueCard
                    key={a.id}
                    appt={a}
                    onAction={(action) => transition.mutate({ id: a.id, action })}
                  />
                ))
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Upcoming appointments (next 14 days) */}
      <Card>
        <CardHeader
          title="Upcoming appointments"
          description={`${upcomingItems.length} appointment${upcomingItems.length === 1 ? "" : "s"} in the next 14 days`}
          icon={<CalendarCheck size={16} />}
          action={
            <Link to="/appointments" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
              See full calendar <ArrowUpRight size={12} />
            </Link>
          }
        />
        <CardBody>
          {upcoming.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-ink-100 animate-pulse" />
              ))}
            </div>
          ) : Object.keys(upcomingByDay).length === 0 ? (
            <p className="text-sm text-ink-500 py-4 text-center">No upcoming appointments scheduled.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(upcomingByDay).map(([day, appts]) => (
                <UpcomingDay key={day} day={day} appts={appts} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader title="Quick actions" icon={<Activity size={16} />} />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <QuickLink to="/appointments" icon={<CalendarCheck size={16} />} title="All appointments" />
            <QuickLink to="/ai" icon={<Sparkles size={16} />} title="AI assistant" />
            <QuickLink to="/patients" icon={<Users size={16} />} title="Patient directory" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function QueueCard({ appt, onAction }: { appt: Appointment; onAction: (action: string) => void }) {
  const time = appt.starts_at?.slice(11, 16);
  const cta = nextAction(appt.status);
  return (
    <div className="rounded-xl border border-ink-200 p-3 hover:border-brand-300 hover:bg-brand-50/30 transition">
      <div className="flex items-start gap-2.5">
        <Avatar name={appt.patient?.full_name_en} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm text-ink-800 truncate">
              {appt.patient?.full_name_en || appt.patient?.code || "Patient"}
            </div>
            <span className="text-[11px] font-mono text-ink-500">{time}</span>
          </div>
          <div className="text-[11px] text-ink-500 truncate">{appt.reason || "No reason given"}</div>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge tone={statusTone(appt.status)} dot pulse={appt.status === "in_consultation"}>
              {appt.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cta && (
              <button
                onClick={() => onAction(cta.action)}
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium px-2 py-1 transition"
              >
                {cta.icon}{cta.label}
              </button>
            )}
            {(appt.status === "in_consultation" || appt.status === "checked_in" || appt.status === "completed") && (
              <Link
                to={`/consult/${appt.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-medium px-2 py-1 transition"
              >
                <Stethoscope size={12} /> Open chart
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function nextAction(status: string): { action: string; label: string; icon: React.ReactNode } | null {
  if (status === "confirmed") return { action: "check-in", label: "Check in", icon: <UserCheck size={12} /> };
  if (status === "checked_in") return { action: "start", label: "Start", icon: <Play size={12} /> };
  if (status === "in_consultation") return { action: "complete", label: "Complete", icon: <CheckCircle2 size={12} /> };
  return null;
}

function UpcomingDay({ day, appts }: { day: string; appts: Appointment[] }) {
  const date = new Date(day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const daysFromToday = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = isTomorrow
    ? "Tomorrow"
    : daysFromToday < 7
    ? date.toLocaleDateString("en-US", { weekday: "long" })
    : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-sm font-semibold text-ink-800">{label}</span>
        <span className="text-xs text-ink-500 font-mono">{day}</span>
        <span className="text-[11px] text-ink-400 ml-auto">
          {appts.length} appointment{appts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {appts.map((a) => (
          <UpcomingRow key={a.id} appt={a} />
        ))}
      </div>
    </div>
  );
}

function UpcomingRow({ appt }: { appt: Appointment }) {
  const time = appt.starts_at?.slice(11, 16);
  return (
    <Link
      to={`/consult/${appt.id}`}
      className="flex items-center gap-2.5 rounded-xl border border-ink-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/30 transition group"
    >
      <div className="size-9 rounded-lg bg-ink-50 text-ink-600 grid place-items-center font-mono text-xs font-semibold">
        {time}
      </div>
      <Avatar name={appt.patient?.full_name_en} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-ink-800 truncate">
          {appt.patient?.full_name_en || appt.patient?.code || "Patient"}
        </div>
        <div className="text-[11px] text-ink-500 truncate">{appt.reason || "No reason given"}</div>
      </div>
      <Badge tone={statusTone(appt.status)} dot>
        {appt.status.replaceAll("_", " ")}
      </Badge>
    </Link>
  );
}

function Kpi({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: "brand" | "amber" | "violet" | "emerald";
}) {
  const accents: Record<string, string> = {
    brand: "from-brand-500 to-sky-500",
    amber: "from-amber-500 to-rose-500",
    violet: "from-violet-500 to-fuchsia-500",
    emerald: "from-emerald-500 to-teal-600",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/60 card-lift">
      <div className={`absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl ${accents[accent]}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink-900 tabular-nums">{value}</div>
        </div>
        <div className={`size-11 rounded-xl text-white grid place-items-center bg-gradient-to-br shadow-soft ${accents[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon, title }: { to: string; icon: React.ReactNode; title: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 hover:border-brand-300 hover:bg-brand-50/30 transition group">
      <span className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center group-hover:bg-brand-100">{icon}</span>
      <span className="font-medium text-ink-800">{title}</span>
      <ArrowUpRight size={14} className="ml-auto text-ink-400 group-hover:text-brand-600" />
    </Link>
  );
}
