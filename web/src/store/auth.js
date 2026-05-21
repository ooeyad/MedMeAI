import { create } from "zustand";
import { persist } from "zustand/middleware";
export const useAuthStore = create()(persist((set) => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    setSession: (access, refresh, user) => set({ accessToken: access, refreshToken: refresh, user }),
    setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
    logout: () => set({ accessToken: null, refreshToken: null, user: null }),
}), { name: "medme-auth" }));
export function hasPermission(perm) {
    const u = useAuthStore.getState().user;
    if (!u)
        return false;
    if (u.permissions.includes("*"))
        return true;
    if (u.permissions.includes(perm))
        return true;
    const wildcards = perm.split(":").map((_, i, arr) => arr.slice(0, i + 1).join(":") + ":*");
    return wildcards.some((w) => u.permissions.includes(w));
}
