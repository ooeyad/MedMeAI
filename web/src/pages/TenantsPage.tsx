import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Globe, PauseCircle, Plus, X } from "lucide-react";

import { api } from "../api/client";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";

interface Tenant {
  id: number;
  slug: string;
  name: string;
  name_ar?: string;
  is_active: boolean;
  created_at?: string;
}

export function TenantsPage() {
  const roles = useAuthStore((s) => s.user?.roles || []);
  const isSuper = roles.includes("super_admin");
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tenants-list"],
    queryFn: async () => (await api.get("/tenants/")).data,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patch(`/tenants/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenants-list"] }),
  });

  const items: Tenant[] = data?.data || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Tenants"
        subtitle={
          isSuper
            ? "Every medical center / hospital network hosted on this MedMeAI install"
            : "Your organisation"
        }
        icon={<Building2 size={20} />}
        actions={
          isSuper && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-3 py-2 shadow-soft"
            >
              <Plus size={14} /> New tenant
            </button>
          )
        }
      />

      <Card>
        {isLoading ? (
          <CardBody>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-ink-100 rounded animate-pulse" />
              ))}
            </div>
          </CardBody>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Building2 size={20} />}
            title="No tenants yet"
            description="Create the first medical center to onboard onto MedMeAI."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((t) => (
              <li key={t.id} className="p-4 flex items-center gap-3 hover:bg-ink-50/60 transition">
                <Avatar name={t.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-800">{t.name}</div>
                  <div className="text-xs text-ink-500">
                    <span className="font-mono">{t.slug}</span>
                    {t.name_ar && <> · {t.name_ar}</>}
                  </div>
                </div>
                <Badge tone={t.is_active ? "success" : "neutral"} dot pulse={t.is_active}>
                  {t.is_active ? "active" : "inactive"}
                </Badge>
                {isSuper && (
                  <button
                    onClick={() => toggle.mutate({ id: t.id, is_active: !t.is_active })}
                    className="text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"
                  >
                    {t.is_active ? <><PauseCircle size={12} /> Deactivate</> : <><CheckCircle2 size={12} /> Activate</>}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (body: any) => (await api.post("/tenants/", body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants-list"] });
      qc.invalidateQueries({ queryKey: ["tenants-switcher"] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Failed to create tenant"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    create.mutate({ slug, name, name_ar: nameAr || undefined });
  }

  function suggestSlug() {
    const s = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    if (s) setSlug(s);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40 grid place-items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div className="flex items-center gap-2 text-ink-800 font-semibold">
            <Globe size={16} /> Onboard a new medical center
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={16} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Name (English)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !slug && suggestSlug()}
              required
              placeholder="Royal Medical Center"
              className="mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Name (Arabic) — optional</span>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="المركز الطبي الملكي"
              className="mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">Slug (URL-safe id)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              placeholder="royal-medical"
              className="mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <span className="text-xs text-ink-500 mt-1 inline-block">Used internally and in URLs.</span>
          </label>
          {error && <div className="text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-sm rounded-lg px-4 py-2 disabled:opacity-60 shadow-soft"
            >
              <Plus size={14} /> {create.isPending ? "Creating…" : "Create tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
