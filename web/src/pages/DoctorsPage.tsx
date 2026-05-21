import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ChevronDown,
  Filter,
  GraduationCap,
  Languages,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { MoveTenantDialog } from "../components/MoveTenantDialog";
import { NewDoctorModal } from "../components/NewDoctorModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission, useAuthStore } from "../store/auth";

interface Specialty { id: number; name: string }
interface Branch { id: number; name: string }
interface Company { id: number; name: string }

interface Filters {
  q: string;
  specialty_ids: number[];
  branch_id: number | null;
  language: string;
  online_only: boolean;
  min_fee: string;
  max_fee: string;
  active_only: boolean;
  accepts_insurance_id: number | null;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  q: "",
  specialty_ids: [],
  branch_id: null,
  language: "",
  online_only: false,
  min_fee: "",
  max_fee: "",
  active_only: false,
  accepts_insurance_id: null,
  sort: "newest",
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name (A→Z)" },
  { value: "fee_asc", label: "Fee (low → high)" },
  { value: "fee_desc", label: "Fee (high → low)" },
  { value: "experience", label: "Experience" },
];

const COMMON_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
];

export function DoctorsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [qDebounced, setQDebounced] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editDoctor, setEditDoctor] = useState<any | null>(null);
  const [moveDoctor, setMoveDoctor] = useState<any | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isSuper = (useAuthStore.getState().user?.roles || []).includes("super_admin");
  const canCreate = hasPermission("doctors:write");
  const canEdit = hasPermission("doctors:write");

  // Debounce the text search so we don't pummel the API as the user types.
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(filters.q), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Lookup data for filter controls
  const specialtiesQ = useQuery({
    queryKey: ["specialties"],
    queryFn: async () => (await api.get("/doctors/specialties")).data,
  });
  const branchesQ = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.get("/branches/")).data,
  });
  const insurersQ = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get("/insurance/companies")).data,
  });

  const specialties: Specialty[] = specialtiesQ.data?.data || [];
  const branches: Branch[] = branchesQ.data?.data || [];
  const insurers: Company[] = insurersQ.data?.data || [];

  // Build server query params from filters.
  // NOTE: we send multi-value specialty_ids as a comma-separated string
  // (specialty_ids_csv) because axios's default serializer adds `[]` brackets
  // to array params, which Flask's `getlist` doesn't match.
  const queryParams = useMemo(() => {
    const p: Record<string, any> = { page_size: 60 };
    if (qDebounced) p.q = qDebounced;
    if (filters.specialty_ids.length) p.specialty_ids_csv = filters.specialty_ids.join(",");
    if (filters.branch_id) p.branch_id = filters.branch_id;
    if (filters.language) p.language = filters.language;
    if (filters.online_only) p.online_only = true;
    if (filters.min_fee) p.min_fee = Number(filters.min_fee);
    if (filters.max_fee) p.max_fee = Number(filters.max_fee);
    if (filters.active_only) p.active_only = true;
    if (filters.accepts_insurance_id) p.accepts_insurance_id = filters.accepts_insurance_id;
    if (filters.sort && filters.sort !== "newest") p.sort = filters.sort;
    return p;
  }, [qDebounced, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["doctors", queryParams],
    queryFn: async () => (await api.get("/doctors/", { params: queryParams })).data,
    placeholderData: (prev) => prev,
  });
  const items: any[] = data?.data || [];
  const total: number = data?.meta?.total ?? items.length;

  const activeFilterCount =
    (filters.specialty_ids.length ? 1 : 0) +
    (filters.branch_id ? 1 : 0) +
    (filters.language ? 1 : 0) +
    (filters.online_only ? 1 : 0) +
    (filters.min_fee || filters.max_fee ? 1 : 0) +
    (filters.active_only ? 1 : 0) +
    (filters.accepts_insurance_id ? 1 : 0);

  function toggleSpecialty(id: number) {
    setFilters((f) =>
      f.specialty_ids.includes(id)
        ? { ...f, specialty_ids: f.specialty_ids.filter((x) => x !== id) }
        : { ...f, specialty_ids: [...f.specialty_ids, id] },
    );
  }

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Doctors"
        subtitle={`${total} ${total === 1 ? "doctor" : "doctors"} matching your filters`}
        icon={<Stethoscope size={20} />}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Search by name or license…"
                className="pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-full sm:w-72"
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
            {canCreate && (
              <Button variant="gradient" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
                New doctor
              </Button>
            )}
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
              {/* Sort */}
              <FilterSection title="Sort by">
                <div className="relative">
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                    className="w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </FilterSection>

              {/* Specialties */}
              <FilterSection title="Specialties" hint={filters.specialty_ids.length > 0 ? `${filters.specialty_ids.length} selected` : undefined}>
                {specialtiesQ.isLoading ? (
                  <div className="text-xs text-ink-400">Loading…</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {specialties.map((s) => {
                      const active = filters.specialty_ids.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSpecialty(s.id)}
                          className={clsx(
                            "text-xs px-2.5 py-1 rounded-full transition",
                            active
                              ? "bg-brand-600 text-white"
                              : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                          )}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                    {specialties.length === 0 && (
                      <div className="text-xs text-ink-500">No specialties yet</div>
                    )}
                  </div>
                )}
              </FilterSection>

              {/* Branch */}
              <FilterSection title="Branch">
                <div className="relative">
                  <select
                    value={filters.branch_id ?? ""}
                    onChange={(e) =>
                      setFilters({ ...filters, branch_id: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </FilterSection>

              {/* Language */}
              <FilterSection title="Speaks language">
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() =>
                        setFilters({ ...filters, language: filters.language === l.code ? "" : l.code })
                      }
                      className={clsx(
                        "text-xs px-2.5 py-1 rounded-full transition",
                        filters.language === l.code
                          ? "bg-brand-600 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </FilterSection>

              {/* Telemedicine + Active */}
              <FilterSection title="Availability">
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.online_only}
                    onChange={(e) => setFilters({ ...filters, online_only: e.target.checked })}
                    className="size-4 rounded border-ink-300"
                  />
                  <span className="inline-flex items-center gap-1">
                    <Video size={12} /> Telemedicine only
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={filters.active_only}
                    onChange={(e) => setFilters({ ...filters, active_only: e.target.checked })}
                    className="size-4 rounded border-ink-300"
                  />
                  Active only
                </label>
              </FilterSection>

              {/* Fee range */}
              <FilterSection title="Consultation fee">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={filters.min_fee}
                    onChange={(e) => setFilters({ ...filters, min_fee: e.target.value })}
                    placeholder="Min"
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <span className="text-ink-400 text-xs">to</span>
                  <input
                    type="number"
                    min={0}
                    value={filters.max_fee}
                    onChange={(e) => setFilters({ ...filters, max_fee: e.target.value })}
                    placeholder="Max"
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </FilterSection>

              {/* Accepts insurance */}
              <FilterSection title="Accepts insurance">
                <div className="relative">
                  <select
                    value={filters.accepts_insurance_id ?? ""}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        accepts_insurance_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full appearance-none h-9 rounded-lg border border-ink-200 bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    <option value="">Any insurer</option>
                    {insurers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                </div>
              </FilterSection>
        </FilterDrawer>

        {/* ===========================  Results  =========================== */}
        <section>
          {/* Active filter chips strip */}
          {activeFilterCount > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 items-center text-xs">
              <span className="text-ink-500 font-medium">Filtering by:</span>
              {filters.specialty_ids.map((sid) => {
                const s = specialties.find((x) => x.id === sid);
                if (!s) return null;
                return (
                  <Chip key={sid} onClear={() => toggleSpecialty(sid)}>
                    {s.name}
                  </Chip>
                );
              })}
              {filters.branch_id && (
                <Chip onClear={() => setFilters({ ...filters, branch_id: null })}>
                  {branches.find((b) => b.id === filters.branch_id)?.name || "Branch"}
                </Chip>
              )}
              {filters.language && (
                <Chip onClear={() => setFilters({ ...filters, language: "" })}>
                  {COMMON_LANGUAGES.find((l) => l.code === filters.language)?.label || filters.language}
                </Chip>
              )}
              {filters.online_only && (
                <Chip onClear={() => setFilters({ ...filters, online_only: false })}>Telemedicine</Chip>
              )}
              {filters.active_only && (
                <Chip onClear={() => setFilters({ ...filters, active_only: false })}>Active only</Chip>
              )}
              {(filters.min_fee || filters.max_fee) && (
                <Chip onClear={() => setFilters({ ...filters, min_fee: "", max_fee: "" })}>
                  {filters.min_fee || "0"} – {filters.max_fee || "∞"}
                </Chip>
              )}
              {filters.accepts_insurance_id && (
                <Chip onClear={() => setFilters({ ...filters, accepts_insurance_id: null })}>
                  {insurers.find((c) => c.id === filters.accepts_insurance_id)?.name || "Insurance"}
                </Chip>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="h-20 bg-ink-100 rounded animate-pulse" />
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Stethoscope size={20} />}
                title="No doctors match these filters"
                description="Try removing a filter or broadening your search."
              />
            </Card>
          ) : (
            <div className={clsx("grid grid-cols-1 md:grid-cols-2 gap-4", isFetching && "opacity-90")}>
              {items.map((d) => (
                <Card key={d.id} hover>
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <Avatar name={d.user?.full_name} size="lg" ring />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-ink-800 truncate">{d.user?.full_name}</div>
                            <div className="text-xs text-ink-500 truncate">
                              {(d.specialties || []).map((s: any) => s.name).join(" · ") || "—"}
                            </div>
                          </div>
                          <Badge tone={d.is_active ? "success" : "neutral"} dot pulse={d.is_active}>
                            {d.is_active ? "active" : "inactive"}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <Pill icon={<GraduationCap size={11} />} label="License" value={d.license_number} />
                          <Pill icon={<Languages size={11} />} label="Languages" value={(d.languages || []).join(", ") || "—"} />
                          {d.consultation_fee != null && (
                            <Pill icon={<span className="text-[10px]">$</span>} label="Fee" value={`${Number(d.consultation_fee).toFixed(0)}`} />
                          )}
                          {d.online_appointments && (
                            <div className="flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-violet-700 text-[11px] font-medium">
                              <Video size={11} /> Telemedicine
                            </div>
                          )}
                        </div>
                        {d.bio && <p className="mt-3 text-xs text-ink-500 line-clamp-2">{d.bio}</p>}

                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          {canEdit && (
                            <button
                              onClick={() => setEditDoctor(d)}
                              className="inline-flex items-center gap-1 rounded-md bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium px-2 py-1 transition"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                          )}
                          {isSuper && (
                            <button
                              onClick={() => setMoveDoctor(d)}
                              className="inline-flex items-center gap-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium px-2 py-1 transition"
                            >
                              <ArrowRightLeft size={11} /> Move tenant
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewDoctorModal open={showCreate} onClose={() => setShowCreate(false)} />
      <NewDoctorModal
        open={!!editDoctor}
        onClose={() => setEditDoctor(null)}
        existing={editDoctor}
      />
      <MoveTenantDialog
        open={!!moveDoctor}
        onClose={() => setMoveDoctor(null)}
        entityKind="doctor"
        entityId={moveDoctor?.id || 0}
        entityName={moveDoctor?.user?.full_name || "doctor"}
        currentTenantId={moveDoctor?.tenant_id}
      />
    </div>
  );
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
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

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-ink-50 px-2 py-1 text-ink-600 truncate">
      <span className="text-ink-400">{icon}</span>
      <span className="text-ink-500">{label}:</span>
      <span className="font-medium text-ink-800 truncate">{value}</span>
    </div>
  );
}
