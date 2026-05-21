import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  permissions: string[];
  preferred_language: string;
  patient_id?: number | null;
  doctor_id?: number | null;
  tenant_id?: number | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setSession: (access: string, refresh: string, user: AuthUser) => void;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (access, refresh, user) =>
        set({ accessToken: access, refreshToken: refresh, user }),
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "medme-auth" },
  ),
);

export function hasPermission(perm: string) {
  const u = useAuthStore.getState().user;
  if (!u) return false;
  if (u.permissions.includes("*")) return true;
  if (u.permissions.includes(perm)) return true;
  const wildcards = perm.split(":").map((_, i, arr) => arr.slice(0, i + 1).join(":") + ":*");
  return wildcards.some((w) => u.permissions.includes(w));
}
