import axios from "axios";
import { useAuthStore } from "../store/auth";
// Same-origin by default so the Vite dev/preview proxy can forward /api/* to
// the Flask backend. This means the phone only needs to talk to ONE address
// (the LAN IP serving the web app) — no CORS, no second port to remember.
// To point at a remote/staging backend, set VITE_API_BASE_URL.
const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";
export const api = axios.create({
    baseURL,
    headers: { "Content-Type": "application/json" },
});
let refreshing = null;
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Super-admin can override the active tenant by setting this in localStorage.
    const activeTenant = typeof window !== "undefined"
        ? window.localStorage.getItem("medme-active-tenant-id")
        : null;
    if (activeTenant) {
        config.headers = config.headers ?? {};
        config.headers["X-Tenant-Id"] = activeTenant;
    }
    return config;
});
api.interceptors.response.use((res) => res, async (err) => {
    if (err.response?.status !== 401) {
        return Promise.reject(err);
    }
    const original = err.config;
    if (original._retried) {
        useAuthStore.getState().logout();
        return Promise.reject(err);
    }
    original._retried = true;
    refreshing ??= (async () => {
        const refresh = useAuthStore.getState().refreshToken;
        if (!refresh)
            return null;
        try {
            const res = await axios.post(`${baseURL}/auth/refresh`, undefined, {
                headers: { Authorization: `Bearer ${refresh}` },
            });
            const { access_token, refresh_token } = res.data;
            useAuthStore.getState().setTokens(access_token, refresh_token);
            return access_token;
        }
        catch {
            useAuthStore.getState().logout();
            return null;
        }
    })();
    const newAccess = await refreshing;
    refreshing = null;
    if (!newAccess)
        return Promise.reject(err);
    original.headers = { ...(original.headers || {}), Authorization: `Bearer ${newAccess}` };
    return api.request(original);
});
