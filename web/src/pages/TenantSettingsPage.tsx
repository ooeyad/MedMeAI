import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Globe,
  Image as ImageIcon,
  Palette,
  Phone,
  Save,
  Settings as SettingsIcon,
  Sparkles,
  Mail,
} from "lucide-react";

import { api } from "../api/client";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuthStore } from "../store/auth";
import { useTenantStore } from "../store/tenant";

export function TenantSettingsPage() {
  const userTenantId = useAuthStore((s) => s.user?.tenant_id);
  const tenantFromStore = useTenantStore((s) => s.tenant?.id);
  const refreshTenant = useTenantStore((s) => s.fetch);
  // Fall back to the tenant fetched at app boot if the cached login session
  // doesn't have a tenant_id (e.g. user signed in before tenancy launched).
  const tenantId = userTenantId ?? tenantFromStore;

  const tenantQ = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => (await api.get(`/tenants/${tenantId}`)).data,
    enabled: !!tenantId,
  });

  const settingsQ = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => (await api.get(`/tenants/${tenantId}/settings`)).data,
    enabled: !!tenantId,
  });

  const [form, setForm] = useState<any>({});
  const [tenantForm, setTenantForm] = useState<any>({});
  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);
  useEffect(() => {
    if (tenantQ.data) setTenantForm({ name: tenantQ.data.name, name_ar: tenantQ.data.name_ar });
  }, [tenantQ.data]);

  const qc = useQueryClient();
  const saveTenant = useMutation({
    mutationFn: async () => api.patch(`/tenants/${tenantId}`, tenantForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant", tenantId] }); refreshTenant(); },
  });
  const saveSettings = useMutation({
    mutationFn: async () => api.put(`/tenants/${tenantId}/settings`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-settings", tenantId] }); refreshTenant(); },
  });

  if (!tenantId) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="Tenant Settings" icon={<SettingsIcon size={20} />} />
        <Card><CardBody>You're not attached to a tenant.</CardBody></Card>
      </div>
    );
  }

  function toggleFeature(name: string) {
    const features = { ...(form.features || {}) };
    features[name] = !features[name];
    setForm({ ...form, features });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Tenant Settings"
        subtitle="Customise branding, defaults, and feature flags for your medical center"
        icon={<SettingsIcon size={20} />}
      />

      {/* Identity */}
      <Card>
        <CardHeader
          title="Organisation"
          icon={<Building2 size={16} />}
          description="The name shown across staff and patient portals"
          action={
            <button
              onClick={() => saveTenant.mutate()}
              disabled={saveTenant.isPending}
              className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft"
            >
              <Save size={14} /> {saveTenant.isPending ? "Saving…" : saveTenant.isSuccess ? "Saved" : "Save"}
            </button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name (English)" value={tenantForm.name || ""} onChange={(v) => setTenantForm({ ...tenantForm, name: v })} />
            <Field label="Name (Arabic)" value={tenantForm.name_ar || ""} onChange={(v) => setTenantForm({ ...tenantForm, name_ar: v })} />
          </div>
        </CardBody>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader
          title="Branding"
          icon={<Palette size={16} />}
          description="Logo, colors, and tagline shown across the apps"
          action={<SaveButton onClick={() => saveSettings.mutate()} pending={saveSettings.isPending} success={saveSettings.isSuccess} />}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Logo URL" placeholder="https://…" icon={<ImageIcon size={14} />} value={form.logo_url || ""} onChange={(v) => setForm({ ...form, logo_url: v })} />
            <Field label="Favicon URL" placeholder="https://…" value={form.favicon_url || ""} onChange={(v) => setForm({ ...form, favicon_url: v })} />
            <Field label="Primary color" placeholder="#14b8a6" value={form.primary_color || ""} onChange={(v) => setForm({ ...form, primary_color: v })} />
            <Field label="Accent color" placeholder="#0ea5e9" value={form.accent_color || ""} onChange={(v) => setForm({ ...form, accent_color: v })} />
            <Field label="Tagline" placeholder="Medical Appointment Platform" value={form.tagline || ""} onChange={(v) => setForm({ ...form, tagline: v })} className="md:col-span-2" />
          </div>
          {(form.logo_url || form.primary_color) && (
            <div className="mt-4 rounded-lg border border-ink-200 p-3 flex items-center gap-3">
              <span className="text-xs text-ink-500 uppercase font-semibold tracking-wider">Preview</span>
              {form.logo_url && <img src={form.logo_url} alt="logo" className="size-10 rounded-md object-cover" />}
              {form.primary_color && <span className="inline-block size-6 rounded-full ring-1 ring-ink-200" style={{ background: form.primary_color }} />}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Regional + booking defaults */}
      <Card>
        <CardHeader
          title="Regional & booking defaults"
          icon={<Globe size={16} />}
          description="Applied when creating new clinics, schedules, and appointments"
          action={<SaveButton onClick={() => saveSettings.mutate()} pending={saveSettings.isPending} success={saveSettings.isSuccess} />}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Default timezone" placeholder="Asia/Amman" value={form.default_timezone || ""} onChange={(v) => setForm({ ...form, default_timezone: v })} />
            <Field label="Default language" placeholder="en" value={form.default_language || ""} onChange={(v) => setForm({ ...form, default_language: v })} />
            <Field label="Currency" placeholder="JOD" value={form.currency || ""} onChange={(v) => setForm({ ...form, currency: v })} />
            <Field label="Slot minutes" placeholder="30" value={String(form.appointment_slot_minutes_default ?? "")} onChange={(v) => setForm({ ...form, appointment_slot_minutes_default: Number(v) || 30 })} />
            <Field label="Supported languages (comma)" placeholder="en, ar" value={(form.supported_languages || []).join(", ")} onChange={(v) => setForm({ ...form, supported_languages: v.split(",").map((s: string) => s.trim()).filter(Boolean) })} className="md:col-span-2" />
          </div>
        </CardBody>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader
          title="Features"
          icon={<Sparkles size={16} />}
          description="Toggle modules per tenant"
          action={<SaveButton onClick={() => saveSettings.mutate()} pending={saveSettings.isPending} success={saveSettings.isSuccess} />}
        />
        <CardBody>
          <div className="space-y-2">
            <FeatureToggle
              label="AI assistant"
              description="Show the AI chat across all portals"
              checked={!!form.features?.ai_assistant}
              onChange={() => toggleFeature("ai_assistant")}
            />
            <FeatureToggle
              label="Telemedicine"
              description="Enable video appointments and remote consultations"
              checked={!!form.features?.telemedicine}
              onChange={() => toggleFeature("telemedicine")}
            />
            <FeatureToggle
              label="Patient self-registration"
              description="Allow patients to sign up themselves (otherwise secretary-only)"
              checked={!!form.features?.patient_self_registration}
              onChange={() => toggleFeature("patient_self_registration")}
            />
            <FeatureToggle
              label="Require KYC before booking"
              description="Block appointment booking until KYC documents are verified"
              checked={!!form.features?.require_kyc_before_booking}
              onChange={() => toggleFeature("require_kyc_before_booking")}
            />
            <FeatureToggle
              label="Show branding in emails"
              description="Include tenant logo and colors in notification emails"
              checked={!!form.features?.show_branding_in_emails}
              onChange={() => toggleFeature("show_branding_in_emails")}
            />
          </div>
        </CardBody>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader
          title="Public contact"
          icon={<Phone size={16} />}
          description="Visible to patients in the app and outbound emails"
          action={<SaveButton onClick={() => saveSettings.mutate()} pending={saveSettings.isPending} success={saveSettings.isSuccess} />}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Support email" icon={<Mail size={14} />} placeholder="support@…" value={form.support_email || ""} onChange={(v) => setForm({ ...form, support_email: v })} />
            <Field label="Support phone" icon={<Phone size={14} />} value={form.support_phone || ""} onChange={(v) => setForm({ ...form, support_phone: v })} />
            <Field label="Website URL" placeholder="https://…" value={form.website_url || ""} onChange={(v) => setForm({ ...form, website_url: v })} />
            <Field label="Public address" value={form.public_address || ""} onChange={(v) => setForm({ ...form, public_address: v })} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Field({
  label, value, onChange, placeholder, icon, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</label>
      <div className="mt-1 relative">
        {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">{icon}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 rounded-lg border border-ink-200 ${icon ? "pl-8" : "px-3"} pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300`}
        />
      </div>
    </div>
  );
}

function FeatureToggle({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-ink-50 transition text-left"
    >
      <div className={`mt-0.5 w-10 h-6 rounded-full p-0.5 flex transition ${checked ? "bg-brand-600 justify-end" : "bg-ink-200 justify-start"}`}>
        <span className="size-5 rounded-full bg-white shadow-soft" />
      </div>
      <div>
        <div className="text-sm font-medium text-ink-800">{label}</div>
        <div className="text-xs text-ink-500 mt-0.5">{description}</div>
      </div>
    </button>
  );
}

function SaveButton({ onClick, pending, success }: { onClick: () => void; pending: boolean; success: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 shadow-soft"
    >
      <Save size={14} /> {pending ? "Saving…" : success ? "Saved" : "Save"}
    </button>
  );
}
