import { create } from "zustand";

import { api } from "../api/client";

export interface TenantInfo {
  id: number;
  slug: string;
  name: string;
  name_ar?: string;
  is_active: boolean;
}

export interface TenantSettings {
  id: number;
  tenant_id: number;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  tagline?: string | null;
  default_timezone: string;
  default_language: string;
  supported_languages?: string[] | null;
  currency: string;
  appointment_slot_minutes_default: number;
  working_hours_default?: Record<string, { open: string; close: string }> | null;
  notification_templates?: Record<string, any> | null;
  features?: Record<string, boolean> | null;
  support_email?: string | null;
  support_phone?: string | null;
  website_url?: string | null;
  public_address?: string | null;
}

interface TenantState {
  tenant: TenantInfo | null;
  settings: TenantSettings | null;
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  settings: null,
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get("/tenants/me");
      set({ tenant: res.data?.tenant, settings: res.data?.settings, loading: false });
      // Apply branding to the CSS variables so the whole app picks it up.
      const c = res.data?.settings?.primary_color;
      if (c && typeof document !== "undefined") {
        document.documentElement.style.setProperty("--brand-color", c);
      }
    } catch (_) {
      set({ loading: false });
    }
  },
}));

export function feature(name: string, fallback = false): boolean {
  const s = useTenantStore.getState().settings;
  return !!(s?.features?.[name] ?? fallback);
}
