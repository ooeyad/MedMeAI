import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Play,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Stethoscope,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

interface Appointment {
  id: number;
  code: string;
  status: string;
  starts_at: string;
  appointment_type?: string;
  source_channel?: string;
  reason?: string;
  patient?: { id: number; code: string; full_name_en: string; phone?: string };
  doctor?: { id: number; user?: { full_name: string } };
}

interface Doctor { id: number; user?: { full_name: string } }
interface Branch { id: number; name: string }

interface Filters {
  q: string;
  statuses: string[];
  doctor_id: number | null;
  branch_id: number | null;
  appointment_types: string[];
  source_channel: string;
  date_from: string;
  date_to: string;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  q: "",
  statuses: [],
  doctor_id: null,
  branch_id: null,
  appointment_types: [],
  source_channel: "",
  date_from: "",
  date_to: "",
  sort: "starts_desc",
};

const STATUS_OPTIONS = [
  { value: "requested", label: "Requested" },
  { value: "pending_confirmation", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked-in" },
  { value: "in_consultation", label: "In consult" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
  { value: "rejected", label: "Rejected" },
  { value: "rescheduled", label: "Rescheduled" },
];

const TYPE_OPTIONS = [
  { value: "new_consultation", label: "New consultation" },
  { value: "follow_up", label: "Follow-up" },
  { value: "lab_review", label: "Lab review" },
  { value: "procedure", label: "Procedure" },
  { value: "emergency", label: "Emergency" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "walk_in", label: "Walk-in" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "secretary", label: "Secretary" },
  { value: "ai", label: "AI assistant" },
  { value: "api", label: "API" },
];

const SORT_OPTIONS = [
  { value: "starts_desc", label: "Soonest end / latest first" },
  { value: "starts_asc", label: "Earliest first" },
  { value: "created_desc", label: "Recently booked" },
  { value: "created_asc", label: "Booked long ago" },
];

function isoDay(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function rangeFor(preset: "today" | "tomorrow" | "this_week" | "next_7" | "next_30" | "past_7") {
  const t = new Date();
  const today = isoDay(t);
  const addDays = (n: number) => {
    const x = new Date(t); x.setDate(x.getDate() + n); return isoDay(x);
  };
  switch (preset) {
    case "today": return { date_from: today, date_to: today };
    case "tomorrow": return { date_from: addDays(1), date_to: addDays(1) };
    case "this_week": {
      const dow = (t.getDay() + 6) % 7; // Monday=0
      return { date_from: addDays(-dow), date_to: addDays(6 - dow) };
    }
    case "next_7": return { date_from: today, date_to: addDays(7) };
    case "next_30": return { date_from: today, date_to: addDays(30) };
    case "past_7": return { date_from: addDays(-7), date_to: today };
  }
}

export function AppointmentsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [qDebounced, setQDebounced] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(filters.q), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Lookups
  const doctorsQ = useQuery({
    queryKey: ["doctors-lite"],
    queryFn: async () => (await api.get("/doctors/", { params: { page_size: 200, sort: "name" } })).data,
  });
  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get("/branches/")).data,
  });
  const doctors: Doctor[] = doctorsQ.data?.data || [];
  const branches: Branch[] = branchesQ.data?.data || [];

  // Build query params.
  // Dates are converted from the user's LOCAL day to a full UTC ISO string
  // before being sent. This ensures "Today" in Amman matches appointment rows
  // that were stored as UTC moments (without this, the off-by-three-hours
  // overlap between local and UTC days would skip some appointments).
  const queryParams = useMemo(() => {
    const p: Record<string, any> = { page_size: 60 };
    if (qDebounced) p.q = qDebounced;
    if (filters.statuses.length) p.statuses_csv = filters.statuses.join(",");
    if (filters.doctor_id) p.doctor_id = filters.doctor_id;
    if (filters.branch_id) p.branch_id = filters.branch_id;
    if (filters.appointment_types.length) p.appointment_types_csv = filters.appointment_types.join(",");
    if (filters.source_channel) p.source_channel = filters.source_channel;
    if (filters.date_from) {
      const d = new Date(`${filters.date_from}T00:00:00`); // local midnight
      p.date_from = d.toISOString();                       // UTC ISO with Z
    }
    if (filters.date_to) {
      const d = new Date(`${filters.date_to}T23:59:59`);   // local end of day
      p.date_to = d.toISOString();
    }
    if (filters.sort && filters.sort !== "starts_desc") p.sort = filters.sort;
    return p;
  }, [qDebounced, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["appointments", queryParams],
    queryFn: async () => (await api.get("/appointments/", { params: queryParams })).data,
    placeholderData: (prev) => prev,
  });
  const items: Appointment[] = data?.data || [];
  const total: number = data?.meta?.total ?? items.length;

  const transition = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) =>
      api.post(`/appointments/${id}/${action}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const activeFilterCount =
    (filters.statuses.length ? 1 : 0) +
    (filters.doctor_id ? 1 : 0) +
    (filters.branch_id ? 1 : 0) +
    (filters.appointment_types.length ? 1 : 0) +
    (filters.source_channel ? 1 : 0) +
    (filters.date_from || filters.date_to ? 1 : 0);

  function toggleStatus(value: string) {
    setFilters((f) =>
      f.statuses.includes(value)
        ? { ...f, statuses: f.statuses.filter((s) => s !== value) }
        : { ...f, statuses: [...f.statuses, value] },
    );
  }
  function toggleType(value: string) {
    setFilters((f) =>
      f.appointment_types.includes(value)
        ? { ...f, appointment_types: f.appointment_types.filter((t) => t !== value) }
        : { ...f, appointment_types: [...f.appointment_types, value] },
    );
  }
  function applyPreset(preset: Parameters<typeof rangeFor>[0]) {
    const r = rangeFor(preset);
    setFilters((f) => ({ ...f, ...r }));
  }
  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  // Which preset (if any) corresponds to the current date_from/date_to so we
  // can highlight that button.
  const activePreset = useMemo<Parameters<typeof rangeFor>[0] | null>(() => {
    if (!filters.date_from || !filters.date_to) return null;
    const presets: Parameters<typeof rangeFor>[0][] = [
      "today", "tomorrow", "this_week", "next_7", "next_30", "past_7",
    ];
    for (const p of presets) {
      const r = rangeFor(p);
      if (r.date_from === filters.date_from && r.date_to === filters.date_to) return p;
    }
    return null;
  }, [filters.date_from, filters.date_to]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Appointments"
        subtitle={`${total} ${total === 1 ? "appointment" : "appointments"} matching your filters`}
        icon={<Calendar size={20} />}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Patient, code, phone, reason…"
                className="pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full sm:w-80"
              />
            </div>
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={clsx(
                "lg:hidden inline-flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border border-ink-200",
                activeFilterCount > 0
                  ? "bg-brand-50 text-brand-700 border-brand-200"
                  : "bg-white text-ink-700",
              )}
            >
              <SlidersHorizontal size={14} /> Filters
              {activeFilterCount > 0 && (
                <span className="bg-brand-600 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <Link to="/appointments/book">
              <Button variant="gradient" icon={<Plus size={14} />}>Book</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ===========================  Filter drawer  =========================== */}
        <FilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onReset={reset}
          activeFilterCount={activeFilterCount}
        >
              <FilterSection title="Sort by">
                <SelectField
                  value={filters.sort}
                  onChange={(v) => setFilters({ ...filters, sort: v })}
                  options={SORT_OPTIONS}
                />
              </FilterSection>

              <FilterSection title="Date" hint="Quick picks">
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <PresetButton active={activePreset === "today"} onClick={() => applyPreset("today")}>Today</PresetButton>
                  <PresetButton active={activePreset === "tomorrow"} onClick={() => applyPreset("tomorrow")}>Tomorrow</PresetButton>
                  <PresetButton active={activePreset === "this_week"} onClick={() => applyPreset("this_week")}>This week</PresetButton>
                  <PresetButton active={activePreset === "next_7"} onClick={() => applyPreset("next_7")}>Next 7 days</PresetButton>
                  <PresetButton active={activePreset === "next_30"} onClick={() => applyPreset("next_30")}>Next 30 days</PresetButton>
                  <PresetButton active={activePreset === "past_7"} onClick={() => applyPreset("past_7")}>Past 7 days</PresetButton>
                </div>
                <div className="space-y-1.5">
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </FilterSection>

              <FilterSection
                title="Status"
                hint={filters.statuses.length > 0 ? `${filters.statuses.length} selected` : undefined}
              >
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((o) => {
                    const active = filters.statuses.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() => toggleStatus(o.value)}
                        className={clsx(
                          "text-xs px-2.5 py-1 rounded-full transition",
                          active
                            ? "bg-brand-600 text-white"
                            : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <FilterSection title="Doctor">
                <SelectField
                  value={filters.doctor_id ? String(filters.doctor_id) : ""}
                  onChange={(v) => setFilters({ ...filters, doctor_id: v ? Number(v) : null })}
                  options={[
                    { value: "", label: "Any doctor" },
                    ...doctors.map((d) => ({
                      value: String(d.id),
                      label: d.user?.full_name || `Doctor #${d.id}`,
                    })),
                  ]}
                />
              </FilterSection>

              <FilterSection title="Branch">
                <SelectField
                  value={filters.branch_id ? String(filters.branch_id) : ""}
                  onChange={(v) => setFilters({ ...filters, branch_id: v ? Number(v) : null })}
                  options={[
                    { value: "", label: "Any branch" },
                    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
                  ]}
                />
              </FilterSection>

              <FilterSection
                title="Type"
                hint={filters.appointment_types.length > 0 ? `${filters.appointment_types.length} selected` : undefined}
              >
                <div className="flex flex-wrap gap-1.5">
                  {TYPE_OPTIONS.map((o) => {
                    const active = filters.appointment_types.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() => toggleType(o.value)}
                        className={clsx(
                          "text-xs px-2.5 py-1 rounded-full transition",
                          active
                            ? "bg-brand-600 text-white"
                            : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </FilterSection>

              <FilterSection title="Booked via">
                <SelectField
                  value={filters.source_channel}
                  onChange={(v) => setFilters({ ...filters, source_channel: v })}
                  options={SOURCE_OPTIONS}
                />
              </FilterSection>
        </FilterDrawer>

        {/* ===========================  Results  =========================== */}
        <section>
          {activeFilterCount > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 items-center text-xs">
              <span className="text-ink-500 font-medium">Filtering by:</span>
              {filters.statuses.map((s) => (
                <Chip key={s} onClear={() => toggleStatus(s)}>
                  {STATUS_OPTIONS.find((o) => o.value === s)?.label || s}
                </Chip>
              ))}
              {filters.appointment_types.map((t) => (
                <Chip key={t} onClear={() => toggleType(t)}>
                  {TYPE_OPTIONS.find((o) => o.value === t)?.label || t}
                </Chip>
              ))}
              {filters.doctor_id && (
                <Chip onClear={() => setFilters({ ...filters, doctor_id: null })}>
                  Dr. {doctors.find((d) => d.id === filters.doctor_id)?.user?.full_name || "—"}
                </Chip>
              )}
              {filters.branch_id && (
                <Chip onClear={() => setFilters({ ...filters, branch_id: null })}>
                  {branches.find((b) => b.id === filters.branch_id)?.name || "Branch"}
                </Chip>
              )}
              {filters.source_channel && (
                <Chip onClear={() => setFilters({ ...filters, source_channel: "" })}>
                  via {filters.source_channel}
                </Chip>
              )}
              {(filters.date_from || filters.date_to) && (
                <Chip onClear={() => setFilters({ ...filters, date_from: "", date_to: "" })}>
                  <CalendarDays size={10} className="inline" />{" "}
                  {filters.date_from || "…"} → {filters.date_to || "…"}
                </Chip>
              )}
            </div>
          )}

          <Card>
            {isLoading ? (
              <div className="p-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-ink-100 rounded animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Calendar size={20} />}
                title="No matching appointments"
                description="Try clearing some filters or pick a wider date range."
              />
            ) : (
              <div className={clsx("overflow-x-auto", isFetching && "opacity-90")}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                      <th className="px-5 py-3">Patient</th>
                      <th className="py-3">Code</th>
                      <th className="py-3">Doctor</th>
                      <th className="py-3">When</th>
                      <th className="py-3">Type</th>
                      <th className="py-3">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {items.map((a) => (
                      <tr key={a.id} className="hover:bg-ink-50/60 transition">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={a.patient?.full_name_en} size="sm" />
                            <div className="min-w-0">
                              <div className="font-medium text-ink-800 truncate">
                                {a.patient?.full_name_en || a.patient?.code || "—"}
                              </div>
                              {a.patient?.phone && (
                                <div className="text-xs text-ink-500">{a.patient.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-ink-500">{a.code}</td>
                        <td className="py-3 text-ink-700">
                          <div className="flex items-center gap-1.5">
                            <Stethoscope size={12} className="text-ink-400" />
                            {a.doctor?.user?.full_name || "—"}
                          </div>
                        </td>
                        <td className="py-3 text-ink-600">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-ink-400" />
                            <span className="font-mono text-xs">
                              {a.starts_at?.slice(0, 16).replace("T", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-ink-600 text-xs">
                          {a.appointment_type?.replaceAll("_", " ") || "—"}
                          {a.source_channel && a.source_channel !== "web" && (
                            <div className="text-[10px] text-ink-400 mt-0.5">via {a.source_channel}</div>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge tone={statusTone(a.status)} dot pulse={a.status === "in_consultation"}>
                            {a.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ActionMenu appt={a} onAction={(action) => transition.mutate({ id: a.id, action })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

function FilterSection({
  title, hint, children,
}: {
  title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2 flex items-center justify-between">
        <span>{title}</span>
        {hint && <span className="text-ink-400 normal-case font-normal">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SelectField({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
    </div>
  );
}

function PresetButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-xs px-2 py-1.5 rounded-md transition",
        active
          ? "bg-brand-600 text-white shadow-soft"
          : "bg-ink-100 text-ink-700 hover:bg-brand-50 hover:text-brand-700",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-0.5">
      {children}
      <button onClick={onClear} className="hover:text-brand-900">
        <X size={10} />
      </button>
    </span>
  );
}

function ActionMenu({ appt, onAction }: { appt: Appointment; onAction: (action: string) => void }) {
  const actions: { label: string; action: string; tone: "primary" | "danger" | "ghost"; icon?: React.ReactNode }[] = [];
  if (appt.status === "requested" || appt.status === "pending_confirmation") {
    actions.push({ label: "Confirm", action: "confirm", tone: "primary", icon: <CheckCircle2 size={12} /> });
  }
  if (appt.status === "confirmed") {
    actions.push({ label: "Check-in", action: "check-in", tone: "primary", icon: <CheckCircle2 size={12} /> });
  }
  if (appt.status === "checked_in") {
    actions.push({ label: "Start", action: "start", tone: "primary", icon: <Play size={12} /> });
  }
  if (appt.status === "in_consultation") {
    actions.push({ label: "Complete", action: "complete", tone: "primary", icon: <CheckCircle2 size={12} /> });
  }
  if (["requested", "confirmed", "pending_confirmation", "checked_in"].includes(appt.status)) {
    actions.push({ label: "Cancel", action: "cancel", tone: "danger", icon: <XCircle size={12} /> });
  }

  if (!actions.length) return <span className="text-xs text-ink-400">—</span>;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions.map((a) => (
        <button
          key={a.action}
          onClick={() => onAction(a.action)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
            a.tone === "danger"
              ? "text-rose-600 hover:bg-rose-50"
              : "text-brand-600 hover:bg-brand-50"
          }`}
        >
          {a.icon}{a.label}
        </button>
      ))}
    </div>
  );
}
