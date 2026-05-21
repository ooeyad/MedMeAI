import { create } from "zustand";
import { api } from "../api/client";
export const useTenantStore = create((set) => ({
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
        }
        catch (_) {
            set({ loading: false });
        }
    },
}));
export function feature(name, fallback = false) {
    const s = useTenantStore.getState().settings;
    return !!(s?.features?.[name] ?? fallback);
}
