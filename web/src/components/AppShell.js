import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, Beaker, Bell, Bot, Building2, Calendar, ChevronDown, ClipboardCheck, FileSearch, FlaskConical, HeartPulse, LayoutDashboard, LogOut, Menu, Pill, Receipt, Search, ShieldCheck, Stethoscope, Tag, Users, Wrench, X, } from "lucide-react";
import clsx from "clsx";
import { api } from "../api/client";
import { hasPermission, useAuthStore } from "../store/auth";
import { useTenantStore } from "../store/tenant";
import { Avatar } from "./ui/Avatar";
import { TenantSwitcher } from "./TenantSwitcher";
const NAV = [
    { to: "/", label: "Dashboard", icon: _jsx(LayoutDashboard, { size: 18 }), group: "main" },
    { to: "/appointments", label: "Appointments", icon: _jsx(Calendar, { size: 18 }), permission: "appointments:read", group: "main" },
    { to: "/patients", label: "Patients", icon: _jsx(Users, { size: 18 }), permission: "patients:read", group: "main" },
    { to: "/doctors", label: "Doctors", icon: _jsx(Stethoscope, { size: 18 }), permission: "doctors:read", group: "main" },
    { to: "/kyc", label: "KYC Review", icon: _jsx(ClipboardCheck, { size: 18 }), permission: "kyc:read", group: "ops" },
    { to: "/insurance", label: "Insurance", icon: _jsx(ShieldCheck, { size: 18 }), permission: "insurance:read", group: "ops" },
    { to: "/ai", label: "AI Assistant", icon: _jsx(Bot, { size: 18 }), group: "ops" },
    { to: "/invoices", label: "Invoices", icon: _jsx(Receipt, { size: 18 }), permission: "patients:read", group: "finance" },
    { to: "/price-list", label: "Price list", icon: _jsx(Tag, { size: 18 }), permission: "patients:read", group: "finance" },
    { to: "/price-list?kind=medication", label: "Medications", icon: _jsx(Pill, { size: 18 }), permission: "users:write", group: "lookups" },
    { to: "/price-list?kind=lab_test", label: "Lab tests", icon: _jsx(FlaskConical, { size: 18 }), permission: "users:write", group: "lookups" },
    { to: "/price-list?kind=imaging", label: "Imaging", icon: _jsx(Beaker, { size: 18 }), permission: "users:write", group: "lookups" },
    { to: "/price-list?kind=procedure", label: "Procedures", icon: _jsx(Wrench, { size: 18 }), permission: "users:write", group: "lookups" },
    { to: "/price-list?kind=consultation", label: "Consultation fees", icon: _jsx(Stethoscope, { size: 18 }), permission: "users:write", group: "lookups" },
    { to: "/lookups/specialties", label: "Specialties", icon: _jsx(Stethoscope, { size: 18 }), permission: "doctors:write", group: "lookups" },
    { to: "/lookups/insurance-companies", label: "Insurance companies", icon: _jsx(ShieldCheck, { size: 18 }), permission: "insurance:write", group: "lookups" },
    { to: "/reports", label: "Reports", icon: _jsx(Activity, { size: 18 }), permission: "reports:read", group: "system" },
    { to: "/audit", label: "Audit Log", icon: _jsx(FileSearch, { size: 18 }), permission: "audit:read", group: "system" },
    { to: "/tenants", label: "Tenants", icon: _jsx(Building2, { size: 18 }), permission: "*", group: "system" },
    { to: "/settings", label: "Tenant Settings", icon: _jsx(Building2, { size: 18 }), permission: "users:write", group: "system" },
];
const GROUP_LABELS = {
    main: "Overview",
    ops: "Operations",
    finance: "Finance",
    lookups: "Lookups",
    system: "System",
};
export function AppShell({ children }) {
    const location = useLocation();
    const user = useAuthStore((s) => s.user);
    const tenant = useTenantStore((s) => s.tenant);
    const tenantSettings = useTenantStore((s) => s.settings);
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const items = NAV.filter((n) => !n.permission || hasPermission(n.permission));
    const groups = Object.keys(GROUP_LABELS)
        .map((g) => ({ key: g, label: GROUP_LABELS[g], items: items.filter((i) => i.group === g) }))
        .filter((g) => g.items.length);
    async function onLogout() {
        try {
            await api.post("/auth/logout");
        }
        catch (_) { }
        useAuthStore.getState().logout();
        navigate("/login", { replace: true });
    }
    // Active-link helper that understands paths with query strings (e.g. /price-list?kind=medication).
    function isActive(to) {
        const [navPath, navQuery] = to.split("?");
        if (navQuery) {
            // Per-kind shortcut: pathname must match exactly AND every key in the
            // shortcut's query must be present with the same value in the URL.
            if (location.pathname !== navPath)
                return false;
            const want = new URLSearchParams(navQuery);
            const have = new URLSearchParams(location.search);
            for (const [k, v] of want.entries()) {
                if (have.get(k) !== v)
                    return false;
            }
            return true;
        }
        if (navPath === "/")
            return location.pathname === "/";
        if (location.pathname !== navPath && !location.pathname.startsWith(navPath + "/"))
            return false;
        // Don't highlight the unfiltered "Price list" entry when the user is on a per-kind shortcut.
        if (navPath === "/price-list" && location.search.includes("kind="))
            return false;
        return true;
    }
    const current = items.find((n) => isActive(n.to));
    return (_jsxs("div", { className: "min-h-screen flex", children: [_jsxs("aside", { className: clsx("fixed inset-y-0 left-0 z-40 w-72 transform bg-white border-r border-ink-100 transition-transform md:translate-x-0 md:static md:flex md:flex-col", mobileOpen ? "translate-x-0" : "-translate-x-full"), children: [_jsxs("div", { className: "px-5 py-5 flex items-center gap-3 border-b border-ink-100", children: [tenantSettings?.logo_url ? (_jsx("img", { src: tenantSettings.logo_url, alt: tenant?.name || "Tenant", className: "size-10 rounded-xl object-cover shadow-soft" })) : (_jsx("div", { className: "size-10 rounded-xl bg-brand-gradient text-white grid place-items-center shadow-soft", children: _jsx(HeartPulse, { size: 20 }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-bold tracking-tight text-ink-900 truncate", children: tenant?.name || "MedMeAI" }), _jsx("div", { className: "text-[11px] text-ink-500 -mt-0.5 truncate", children: tenantSettings?.tagline || "Medical Appointment Platform" })] }), _jsx("button", { className: "md:hidden text-ink-500 p-1", onClick: () => setMobileOpen(false), children: _jsx(X, { size: 18 }) })] }), _jsx("nav", { className: "flex-1 overflow-auto scrollbar-thin px-3 py-4 space-y-5", children: groups.map((g) => (_jsxs("div", { children: [_jsx("div", { className: "px-3 mb-1.5 text-[10px] uppercase tracking-wider font-semibold text-ink-400", children: g.label }), _jsx("ul", { className: "space-y-0.5", children: g.items.map((n) => {
                                        const active = isActive(n.to);
                                        return (_jsx("li", { children: _jsxs(Link, { to: n.to, onClick: () => setMobileOpen(false), className: clsx("group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative", active
                                                    ? "bg-brand-50 text-brand-700 font-medium"
                                                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"), children: [active && (_jsx("span", { className: "absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-brand-500" })), _jsx("span", { className: clsx(active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-600"), children: n.icon }), n.label, n.to === "/ai" && (_jsx("span", { className: "ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold", children: "AI" }))] }) }, n.to));
                                    }) })] }, g.key))) }), _jsx("div", { className: "border-t border-ink-100 p-3", children: _jsx(UserMenu, { user: user, onLogout: onLogout }) })] }), mobileOpen && (_jsx("div", { className: "fixed inset-0 bg-ink-900/40 z-30 md:hidden", onClick: () => setMobileOpen(false) })), _jsxs("main", { className: "flex-1 min-w-0 flex flex-col", children: [_jsxs("header", { className: "bg-white/80 backdrop-blur border-b border-ink-100 px-4 md:px-8 flex items-center gap-4 sticky top-0 z-20", style: {
                            // iPhone notch: push the header below the status bar in PWA mode.
                            paddingTop: "calc(env(safe-area-inset-top, 0px))",
                            paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
                            paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
                            minHeight: "calc(4rem + env(safe-area-inset-top, 0px))",
                        }, children: [_jsx("button", { onClick: () => setMobileOpen(true), className: "md:hidden text-ink-700", children: _jsx(Menu, { size: 20 }) }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-ink-500", children: [_jsx(Building2, { size: 14, className: "text-ink-400" }), _jsx("span", { children: tenant?.name || "MedMeAI" }), _jsx("span", { className: "text-ink-300", children: "/" }), _jsx("span", { className: "text-ink-800 font-medium", children: current?.label || "Dashboard" })] }), _jsx("div", { className: "flex-1" }), _jsx(TenantSwitcher, {}), _jsxs("div", { className: "hidden md:flex items-center gap-2 relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" }), _jsx("input", { placeholder: "Search patients, appointments, doctors\u2026", className: "pl-9 pr-3 h-9 text-sm rounded-lg border border-ink-200 bg-ink-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 w-80" })] }), _jsxs("button", { className: "relative size-9 grid place-items-center rounded-lg text-ink-600 hover:bg-ink-100", children: [_jsx(Bell, { size: 18 }), _jsx("span", { className: "absolute top-1.5 right-1.5 size-1.5 rounded-full bg-rose-500" })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-4 md:p-8 animate-fade-in", children: children })] })] }));
}
function UserMenu({ user, onLogout }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setOpen((v) => !v), className: "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-ink-50 transition", children: [_jsx(Avatar, { name: user?.full_name, size: "md" }), _jsxs("div", { className: "flex-1 min-w-0 text-left", children: [_jsx("div", { className: "text-sm font-medium text-ink-800 truncate", children: user?.full_name }), _jsx("div", { className: "text-[11px] text-ink-500 truncate", children: (user?.roles || []).join(", ") })] }), _jsx(ChevronDown, { size: 14, className: "text-ink-400" })] }), open && (_jsxs("div", { className: "absolute bottom-full mb-2 left-0 right-0 bg-white border border-ink-200 rounded-lg shadow-lift overflow-hidden", children: [_jsxs("div", { className: "px-3 py-2 border-b border-ink-100", children: [_jsx("div", { className: "text-xs text-ink-500", children: "Signed in as" }), _jsx("div", { className: "text-sm font-medium text-ink-800 truncate", children: user?.email })] }), _jsxs("button", { onClick: onLogout, className: "w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50", children: [_jsx(LogOut, { size: 14 }), " Sign out"] })] }))] }));
}
// Back-compat for pages that still import { Section } from AppShell
export function Section({ title, children, action, }) {
    return (_jsxs("section", { className: "rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 px-5 pt-5 pb-3 border-b border-ink-100", children: [_jsx("h2", { className: "text-base font-semibold text-ink-800 tracking-tight", children: title }), action] }), _jsx("div", { className: "p-5", children: children })] }));
}
