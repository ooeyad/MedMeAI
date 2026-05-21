import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Beaker,
  Bell,
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  FileSearch,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Receipt,
  Search,
  ShieldCheck,
  Stethoscope,
  Tag,
  Users,
  Wrench,
  X,
} from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { hasPermission, useAuthStore } from "../store/auth";
import { useTenantStore } from "../store/tenant";
import { Avatar } from "./ui/Avatar";
import { TenantSwitcher } from "./TenantSwitcher";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  permission?: string;
  group: "main" | "ops" | "finance" | "lookups" | "system";
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard size={18} />, group: "main" },
  { to: "/appointments", label: "Appointments", icon: <Calendar size={18} />, permission: "appointments:read", group: "main" },
  { to: "/patients", label: "Patients", icon: <Users size={18} />, permission: "patients:read", group: "main" },
  { to: "/doctors", label: "Doctors", icon: <Stethoscope size={18} />, permission: "doctors:read", group: "main" },

  { to: "/kyc", label: "KYC Review", icon: <ClipboardCheck size={18} />, permission: "kyc:read", group: "ops" },
  { to: "/insurance", label: "Insurance", icon: <ShieldCheck size={18} />, permission: "insurance:read", group: "ops" },
  { to: "/ai", label: "AI Assistant", icon: <Bot size={18} />, group: "ops" },

  { to: "/invoices", label: "Invoices", icon: <Receipt size={18} />, permission: "patients:read", group: "finance" },
  { to: "/price-list", label: "Price list", icon: <Tag size={18} />, permission: "patients:read", group: "finance" },

  { to: "/price-list?kind=medication", label: "Medications", icon: <Pill size={18} />, permission: "users:write", group: "lookups" },
  { to: "/price-list?kind=lab_test", label: "Lab tests", icon: <FlaskConical size={18} />, permission: "users:write", group: "lookups" },
  { to: "/price-list?kind=imaging", label: "Imaging", icon: <Beaker size={18} />, permission: "users:write", group: "lookups" },
  { to: "/price-list?kind=procedure", label: "Procedures", icon: <Wrench size={18} />, permission: "users:write", group: "lookups" },
  { to: "/price-list?kind=consultation", label: "Consultation fees", icon: <Stethoscope size={18} />, permission: "users:write", group: "lookups" },
  { to: "/lookups/specialties", label: "Specialties", icon: <Stethoscope size={18} />, permission: "doctors:write", group: "lookups" },
  { to: "/lookups/insurance-companies", label: "Insurance companies", icon: <ShieldCheck size={18} />, permission: "insurance:write", group: "lookups" },

  { to: "/reports", label: "Reports", icon: <Activity size={18} />, permission: "reports:read", group: "system" },
  { to: "/audit", label: "Audit Log", icon: <FileSearch size={18} />, permission: "audit:read", group: "system" },
  { to: "/tenants", label: "Tenants", icon: <Building2 size={18} />, permission: "*", group: "system" },
  { to: "/settings", label: "Tenant Settings", icon: <Building2 size={18} />, permission: "users:write", group: "system" },
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  main: "Overview",
  ops: "Operations",
  finance: "Finance",
  lookups: "Lookups",
  system: "System",
};

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const tenant = useTenantStore((s) => s.tenant);
  const tenantSettings = useTenantStore((s) => s.settings);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV.filter((n) => !n.permission || hasPermission(n.permission));
  const groups = (Object.keys(GROUP_LABELS) as NavItem["group"][])
    .map((g) => ({ key: g, label: GROUP_LABELS[g], items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length);

  async function onLogout() {
    try { await api.post("/auth/logout"); } catch (_) {}
    useAuthStore.getState().logout();
    navigate("/login", { replace: true });
  }

  // Active-link helper that understands paths with query strings (e.g. /price-list?kind=medication).
  function isActive(to: string): boolean {
    const [navPath, navQuery] = to.split("?");
    if (navQuery) {
      // Per-kind shortcut: pathname must match exactly AND every key in the
      // shortcut's query must be present with the same value in the URL.
      if (location.pathname !== navPath) return false;
      const want = new URLSearchParams(navQuery);
      const have = new URLSearchParams(location.search);
      for (const [k, v] of want.entries()) {
        if (have.get(k) !== v) return false;
      }
      return true;
    }
    if (navPath === "/") return location.pathname === "/";
    if (location.pathname !== navPath && !location.pathname.startsWith(navPath + "/")) return false;
    // Don't highlight the unfiltered "Price list" entry when the user is on a per-kind shortcut.
    if (navPath === "/price-list" && location.search.includes("kind=")) return false;
    return true;
  }

  const current = items.find((n) => isActive(n.to));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-72 transform bg-white border-r border-ink-100 transition-transform md:translate-x-0 md:static md:flex md:flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5 flex items-center gap-3 border-b border-ink-100">
          {tenantSettings?.logo_url ? (
            <img
              src={tenantSettings.logo_url}
              alt={tenant?.name || "Tenant"}
              className="size-10 rounded-xl object-cover shadow-soft"
            />
          ) : (
            <div className="size-10 rounded-xl bg-brand-gradient text-white grid place-items-center shadow-soft">
              <HeartPulse size={20} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold tracking-tight text-ink-900 truncate">
              {tenant?.name || "MedMeAI"}
            </div>
            <div className="text-[11px] text-ink-500 -mt-0.5 truncate">
              {tenantSettings?.tagline || "Medical Appointment Platform"}
            </div>
          </div>
          <button className="md:hidden text-ink-500 p-1" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-auto scrollbar-thin px-3 py-4 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-wider font-semibold text-ink-400">
                {g.label}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((n) => {
                  const active = isActive(n.to);
                  return (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative",
                          active
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-brand-500" />
                        )}
                        <span className={clsx(active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600")}>
                          {n.icon}
                        </span>
                        {n.label}
                        {n.to === "/ai" && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                            AI
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-ink-900/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header
          className="bg-white/80 backdrop-blur border-b border-ink-100 px-4 md:px-8 flex items-center gap-4 sticky top-0 z-20"
          style={{
            // iPhone notch: push the header below the status bar in PWA mode.
            paddingTop: "calc(env(safe-area-inset-top, 0px))",
            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
            minHeight: "calc(4rem + env(safe-area-inset-top, 0px))",
          }}>
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-ink-700">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Building2 size={14} className="text-ink-400" />
            <span>{tenant?.name || "MedMeAI"}</span>
            <span className="text-ink-300">/</span>
            <span className="text-ink-800 font-medium">{current?.label || "Dashboard"}</span>
          </div>

          <div className="flex-1" />

          <TenantSwitcher />

          <div className="hidden md:flex items-center gap-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              placeholder="Search patients, appointments, doctors…"
              className="pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-ink-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-80"
            />
          </div>

          <button className="relative size-9 grid place-items-center rounded-lg text-ink-600 hover:bg-ink-100">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-rose-500" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

function UserMenu({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ink-50 transition"
      >
        <Avatar name={user?.full_name} size="md" />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium text-ink-800 truncate">{user?.full_name}</div>
          <div className="text-[11px] text-ink-500 truncate">{(user?.roles || []).join(", ")}</div>
        </div>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-ink-200 rounded-lg shadow-lift overflow-hidden">
          <div className="px-3 py-2 border-b border-ink-100">
            <div className="text-xs text-ink-500">Signed in as</div>
            <div className="text-sm font-medium text-ink-800 truncate">{user?.email}</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// Back-compat for pages that still import { Section } from AppShell
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60">
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3 border-b border-ink-100">
        <h2 className="text-base font-semibold text-ink-800 tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
