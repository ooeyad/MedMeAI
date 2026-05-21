import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Droplet,
  Filter,
  HeartPulse,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { FilterDrawer } from "../components/FilterDrawer";
import { NewPatientModal } from "../components/NewPatientModal";
import { Avatar } from "../components/ui/Avatar";
import { Badge, statusTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { hasPermission } from "../store/auth";

interface Patient {
  id: number;
  code: string;
  full_name_en: string;
  full_name_ar?: string;
  phone?: string;
  email?: string;
  national_id?: string;
  kyc_status: string;
  gender?: string;
  blood_type?: string;
  date_of_birth?: string;
  allergies?: string[];
  chronic_diseases?: string[];
}

interface Company { id: number; name: string }

interface Filters {
  q: string;
  kyc_status: string;
  gender: string;
  blood_type: string;
  age_min: string;
  age_max: string;
  allergen: string;
  has_chronic: boolean;
  has_insurance: boolean;
  insurance_company_id: number | null;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  q: "",
  kyc_status: "",
  gender: "",
  blood_type: "",
  age_min: "",
  age_max: "",
  allergen: "",
  has_chronic: false,
  has_insurance: false,
  insurance_company_id: null,
  sort: "newest",
};

const KYC_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name (A→Z)" },
  { value: "dob_desc", label: "Youngest first" },
  { value: "dob_asc", label: "Oldest first" },
];

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function PatientsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [qDebounced, setQDebounced] = useState("");
  const [allergenDebounced, setAllergenDebounced] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const canCreate = hasPermission("patients:write");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(filters.q), 250);
    return () => clearTimeout(t);
  }, [filters.q]);

  useEffect(() => {
    const t = setTimeout(() => setAllergenDebounced(filters.allergen), 400);
    return () => clearTimeout(t);
  }, [filters.allergen]);

  const insurersQ = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: async () => (await api.get("/insurance/companies")).data,
  });
  const insurers: Company[] = insurersQ.data?.data || [];

  const queryParams = useMemo(() => {
    const p: Record<string, any> = { page_size: 50 };
    if (qDebounced) p.q = qDebounced;
    if (filters.kyc_status) p.kyc_status = filters.kyc_status;
    if (filters.gender) p.gender = filters.gender;
    if (filters.blood_type) p.blood_type = filters.blood_type;
    if (filters.age_min) p.age_min = Number(filters.age_min);
    if (filters.age_max) p.age_max = Number(filters.age_max);
    if (allergenDebounced) p.allergen = allergenDebounced;
    if (filters.has_chronic) p.has_chronic = true;
    if (filters.has_insurance) p.has_insurance = true;
    if (filters.insurance_company_id) p.insurance_company_id = filters.insurance_company_id;
    if (filters.sort && filters.sort !== "newest") p.sort = filters.sort;
    return p;
  }, [qDebounced, allergenDebounced, filters]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["patients", queryParams],
    queryFn: async () => (await api.get("/patients/", { params: queryParams })).data,
    placeholderData: (prev) => prev,
  });
  const items: Patient[] = data?.data || [];
  const total: number = data?.meta?.total ?? items.length;

  const activeFilterCount =
    (filters.kyc_status ? 1 : 0) +
    (filters.gender ? 1 : 0) +
    (filters.blood_type ? 1 : 0) +
    (filters.age_min || filters.age_max ? 1 : 0) +
    (filters.allergen ? 1 : 0) +
    (filters.has_chronic ? 1 : 0) +
    (filters.has_insurance ? 1 : 0) +
    (filters.insurance_company_id ? 1 : 0);

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Patients"
        subtitle={`${total} ${total === 1 ? "patient" : "patients"} matching your filters`}
        icon={<Users size={20} />}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Name, phone, NID, email, code…"
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
            {canCreate && (
              <Button variant="gradient" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
                New patient
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
              <FilterSection title="Sort by">
                <SelectField
                  value={filters.sort}
                  onChange={(v) => setFilters({ ...filters, sort: v })}
                  options={SORT_OPTIONS}
                />
              </FilterSection>

              <FilterSection title="KYC status">
                <ChipGroup
                  options={KYC_STATUSES}
                  value={filters.kyc_status}
                  onChange={(v) => setFilters({ ...filters, kyc_status: v })}
                />
              </FilterSection>

              <FilterSection title="Gender">
                <ChipGroup
                  options={GENDERS}
                  value={filters.gender}
                  onChange={(v) => setFilters({ ...filters, gender: v })}
                />
              </FilterSection>

              <FilterSection title="Blood type">
                <div className="grid grid-cols-4 gap-1.5">
                  {BLOOD_TYPES.map((bt) => (
                    <button
                      key={bt}
                      onClick={() => setFilters({ ...filters, blood_type: filters.blood_type === bt ? "" : bt })}
                      className={clsx(
                        "text-xs px-2 py-1 rounded-md transition font-mono",
                        filters.blood_type === bt
                          ? "bg-rose-600 text-white"
                          : "bg-ink-100 text-ink-700 hover:bg-ink-200",
                      )}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Age range">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={150}
                    value={filters.age_min}
                    onChange={(e) => setFilters({ ...filters, age_min: e.target.value })}
                    placeholder="Min"
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                  <span className="text-ink-400 text-xs">to</span>
                  <input
                    type="number"
                    min={0}
                    max={150}
                    value={filters.age_max}
                    onChange={(e) => setFilters({ ...filters, age_max: e.target.value })}
                    placeholder="Max"
                    className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              </FilterSection>

              <FilterSection title="Allergen">
                <input
                  value={filters.allergen}
                  onChange={(e) => setFilters({ ...filters, allergen: e.target.value })}
                  placeholder="e.g. penicillin"
                  className="w-full h-9 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </FilterSection>

              <FilterSection title="Medical">
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.has_chronic}
                    onChange={(e) => setFilters({ ...filters, has_chronic: e.target.checked })}
                    className="size-4 rounded border-ink-300"
                  />
                  <span className="inline-flex items-center gap-1">
                    <HeartPulse size={12} /> Has chronic condition(s)
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={filters.has_insurance}
                    onChange={(e) => setFilters({ ...filters, has_insurance: e.target.checked })}
                    className="size-4 rounded border-ink-300"
                  />
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} /> Has insurance on file
                  </span>
                </label>
              </FilterSection>

              <FilterSection title="Insurance company">
                <SelectField
                  value={filters.insurance_company_id ? String(filters.insurance_company_id) : ""}
                  onChange={(v) =>
                    setFilters({ ...filters, insurance_company_id: v ? Number(v) : null })
                  }
                  options={[
                    { value: "", label: "Any insurer" },
                    ...insurers.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </FilterSection>
        </FilterDrawer>

        {/* ===========================  Results  =========================== */}
        <section>
          {activeFilterCount > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5 items-center text-xs">
              <span className="text-ink-500 font-medium">Filtering by:</span>
              {filters.kyc_status && (
                <Chip onClear={() => setFilters({ ...filters, kyc_status: "" })}>
                  KYC: {filters.kyc_status.replaceAll("_", " ")}
                </Chip>
              )}
              {filters.gender && (
                <Chip onClear={() => setFilters({ ...filters, gender: "" })}>
                  {filters.gender}
                </Chip>
              )}
              {filters.blood_type && (
                <Chip onClear={() => setFilters({ ...filters, blood_type: "" })}>
                  {filters.blood_type}
                </Chip>
              )}
              {(filters.age_min || filters.age_max) && (
                <Chip onClear={() => setFilters({ ...filters, age_min: "", age_max: "" })}>
                  Age {filters.age_min || "0"}–{filters.age_max || "∞"}
                </Chip>
              )}
              {filters.allergen && (
                <Chip onClear={() => setFilters({ ...filters, allergen: "" })}>
                  Allergen: {filters.allergen}
                </Chip>
              )}
              {filters.has_chronic && (
                <Chip onClear={() => setFilters({ ...filters, has_chronic: false })}>
                  Chronic
                </Chip>
              )}
              {filters.has_insurance && (
                <Chip onClear={() => setFilters({ ...filters, has_insurance: false })}>
                  Has insurance
                </Chip>
              )}
              {filters.insurance_company_id && (
                <Chip onClear={() => setFilters({ ...filters, insurance_company_id: null })}>
                  {insurers.find((c) => c.id === filters.insurance_company_id)?.name || "Insurer"}
                </Chip>
              )}
            </div>
          )}

          <Card>
            {isLoading ? (
              <CardBody>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-ink-100 rounded animate-pulse" />
                  ))}
                </div>
              </CardBody>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Users size={20} />}
                title="No patients match these filters"
                description="Try removing a filter or broadening your search."
              />
            ) : (
              <div className={clsx("overflow-x-auto", isFetching && "opacity-90")}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-100">
                      <th className="px-5 py-3">Patient</th>
                      <th className="py-3">Code</th>
                      <th className="py-3">Contact</th>
                      <th className="py-3">Age / Sex</th>
                      <th className="py-3">Medical</th>
                      <th className="py-3">KYC</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {items.map((p) => {
                      const age = calcAge(p.date_of_birth);
                      return (
                        <tr key={p.id} className="hover:bg-ink-50/60 transition">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={p.full_name_en} size="sm" />
                              <div className="min-w-0">
                                <div className="font-medium text-ink-800 truncate">{p.full_name_en}</div>
                                {p.full_name_ar && (
                                  <div className="text-xs text-ink-500 truncate">{p.full_name_ar}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-[11px] text-ink-500">{p.code}</td>
                          <td className="py-3 text-ink-700">
                            {p.phone ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Phone size={11} className="text-ink-400" />
                                {p.phone}
                              </span>
                            ) : "—"}
                            {p.national_id && (
                              <div className="text-[10px] text-ink-400 font-mono mt-0.5">NID {p.national_id}</div>
                            )}
                          </td>
                          <td className="py-3 text-ink-700 whitespace-nowrap">
                            {age !== null ? `${age}y` : "—"}
                            {p.gender && (
                              <span className="text-ink-400"> · {p.gender[0].toUpperCase()}</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {p.blood_type && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10px] font-medium">
                                  <Droplet size={9} /> {p.blood_type}
                                </span>
                              )}
                              {p.allergies && p.allergies.length > 0 && (
                                <span
                                  title={p.allergies.join(", ")}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  {p.allergies.length} allerg{p.allergies.length === 1 ? "y" : "ies"}
                                </span>
                              )}
                              {p.chronic_diseases && p.chronic_diseases.length > 0 && (
                                <span
                                  title={p.chronic_diseases.join(", ")}
                                  className="inline-flex items-center gap-1 rounded-md bg-violet-50 text-violet-700 px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                  <HeartPulse size={9} /> {p.chronic_diseases.length} chronic
                                </span>
                              )}
                              {(!p.blood_type && !p.allergies?.length && !p.chronic_diseases?.length) && (
                                <span className="text-ink-400 text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge tone={statusTone(p.kyc_status)} dot>
                              {p.kyc_status.replaceAll("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/patients/${p.id}`}
                              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium"
                            >
                              Open <ArrowUpRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </div>

      <NewPatientModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
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

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(value === o.value ? "" : o.value)}
          className={clsx(
            "text-xs px-2.5 py-1 rounded-full transition",
            value === o.value
              ? "bg-brand-600 text-white"
              : "bg-ink-100 text-ink-700 hover:bg-ink-200",
          )}
        >
          {o.label}
        </button>
      ))}
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
