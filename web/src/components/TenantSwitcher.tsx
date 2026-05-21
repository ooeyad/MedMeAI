import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, Globe } from "lucide-react";
import clsx from "clsx";

import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { useTenantStore } from "../store/tenant";

interface Tenant {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
}

const STORAGE_KEY = "medme-active-tenant-id";

/** Header dropdown — only visible to super_admin. Lets them filter the whole
 *  app to a single tenant via the X-Tenant-Id header (handled in api/client). */
export function TenantSwitcher() {
  const roles = useAuthStore((s) => s.user?.roles || []);
  const isSuper = roles.includes("super_admin");
  const refreshTenant = useTenantStore((s) => s.fetch);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });

  const { data } = useQuery({
    queryKey: ["tenants-switcher"],
    queryFn: async () => (await api.get("/tenants/")).data,
    enabled: isSuper,
  });

  const tenants: Tenant[] = data?.data || [];

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-tenant-switcher]")) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open]);

  if (!isSuper) return null;

  const active = tenants.find((t) => t.id === activeId);

  function select(id: number | null) {
    setActiveId(id);
    if (id == null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    }
    setOpen(false);
    // Refresh tenant info + invalidate every query so the UI reloads under the new scope.
    refreshTenant();
    qc.invalidateQueries();
  }

  return (
    <div className="relative" data-tenant-switcher>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white hover:bg-ink-50 px-3 h-9 text-sm transition"
      >
        <Building2 size={14} className="text-ink-500" />
        <span className="font-medium text-ink-800 max-w-[200px] truncate">
          {active ? active.name : "All tenants"}
        </span>
        <ChevronDown size={12} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg border border-ink-200 shadow-lift overflow-hidden z-30">
          <div className="px-3 py-2 border-b border-ink-100 text-[11px] uppercase tracking-wider font-semibold text-ink-500">
            Active tenant scope
          </div>
          <button
            onClick={() => select(null)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-50 text-left text-sm"
          >
            <Globe size={14} className="text-ink-500" />
            <div className="flex-1">
              <div className="font-medium text-ink-800">All tenants</div>
              <div className="text-xs text-ink-500">Aggregate view (no X-Tenant filter)</div>
            </div>
            {activeId == null && <Check size={14} className="text-brand-600" />}
          </button>
          <div className="max-h-72 overflow-auto scrollbar-thin">
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className={clsx(
                  "w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-50 text-left text-sm",
                  activeId === t.id && "bg-brand-50",
                )}
              >
                <Building2 size={14} className="text-ink-500" />
                <div className="flex-1">
                  <div className="font-medium text-ink-800">{t.name}</div>
                  <div className="text-xs text-ink-500 font-mono">{t.slug}</div>
                </div>
                {activeId === t.id && <Check size={14} className="text-brand-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
