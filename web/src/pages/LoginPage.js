import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeartPulse, Loader2, LogIn, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
const DEMO_USERS = [
    { email: "admin@medme.ai", label: "Super Admin" },
    { email: "secretary@medme.ai", label: "Secretary" },
    { email: "dr.sami@medme.ai", label: "Doctor" },
    { email: "ahmad.ali@example.com", label: "Patient" },
];
export function LoginPage() {
    const [email, setEmail] = useState("secretary@medme.ai");
    const [password, setPassword] = useState("ChangeMe!123");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await api.post("/auth/login", { email, password });
            const { access_token, refresh_token, user } = res.data;
            useAuthStore.getState().setSession(access_token, refresh_token, user);
            navigate("/", { replace: true });
        }
        catch (err) {
            setError(err.response?.data?.error?.message || "Login failed");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsxs("div", { className: "min-h-screen grid lg:grid-cols-2", children: [_jsxs("div", { className: "hidden lg:flex relative overflow-hidden bg-brand-gradient text-white p-12 flex-col justify-between", children: [_jsx("div", { className: "absolute -right-20 -top-20 size-96 rounded-full bg-white/10 blur-3xl" }), _jsx("div", { className: "absolute -left-32 -bottom-32 size-[36rem] rounded-full bg-white/5 blur-3xl" }), _jsx("div", { className: "absolute right-12 bottom-12 opacity-10", children: _jsx(HeartPulse, { size: 280, strokeWidth: 1 }) }), _jsxs("div", { className: "relative flex items-center gap-3", children: [_jsx("div", { className: "size-12 rounded-2xl bg-white/15 backdrop-blur grid place-items-center ring-1 ring-white/30", children: _jsx(HeartPulse, { size: 22 }) }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-lg tracking-tight", children: "MedMeAI" }), _jsx("div", { className: "text-xs text-white/70 -mt-0.5", children: "Medical Appointment Platform" })] })] }), _jsxs("div", { className: "relative max-w-md", children: [_jsxs("div", { className: "inline-flex items-center gap-1.5 text-xs uppercase tracking-wider bg-white/15 ring-1 ring-white/20 rounded-full px-3 py-1 backdrop-blur font-semibold mb-4", children: [_jsx(Sparkles, { size: 12 }), " AI-powered"] }), _jsx("h1", { className: "text-3xl xl:text-4xl font-bold leading-tight tracking-tight", children: "Run your clinic with the calm of a great copilot." }), _jsx("p", { className: "mt-4 text-white/85 leading-relaxed", children: "Patient profiles, KYC verification, doctor schedules, insurance pre-approvals \u2014 all in one place, with an agentic assistant that books, reschedules, and answers natural-language questions safely." }), _jsxs("div", { className: "mt-8 grid grid-cols-3 gap-3", children: [_jsx(Feature, { icon: _jsx(Stethoscope, { size: 16 }), label: "Smart scheduling" }), _jsx(Feature, { icon: _jsx(ShieldCheck, { size: 16 }), label: "Insurance built-in" }), _jsx(Feature, { icon: _jsx(Sparkles, { size: 16 }), label: "Agentic AI" })] })] }), _jsxs("div", { className: "relative text-xs text-white/70", children: ["\u00A9 ", new Date().getFullYear(), " MedMeAI \u2014 built for hospitals, clinics, and insurance-connected providers."] })] }), _jsx("div", { className: "flex items-center justify-center p-6 lg:p-12 bg-ink-50/40", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "lg:hidden flex items-center gap-3 mb-6", children: [_jsx("div", { className: "size-10 rounded-xl bg-brand-gradient text-white grid place-items-center shadow-soft", children: _jsx(HeartPulse, { size: 18 }) }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-ink-900 tracking-tight", children: "MedMeAI" }), _jsx("div", { className: "text-xs text-ink-500 -mt-0.5", children: "Medical Appointment Platform" })] })] }), _jsxs("div", { className: "rounded-2xl bg-white shadow-card ring-1 ring-ink-200/60 p-8", children: [_jsx("h2", { className: "text-xl font-semibold text-ink-900 tracking-tight", children: "Welcome back" }), _jsx("p", { className: "text-sm text-ink-500 mt-1", children: "Sign in to access the appointment platform." }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-4 mt-6", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "text-xs font-medium text-ink-700", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400", required: true })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "text-xs font-medium text-ink-700", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "mt-1 w-full h-10 rounded-lg border border-ink-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400", required: true })] }), error && (_jsx("div", { className: "text-sm text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-lg px-3 py-2", children: error })), _jsxs("button", { disabled: loading, className: "w-full h-11 bg-brand-gradient text-white rounded-lg font-medium text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-soft hover:opacity-95 transition", children: [loading ? _jsx(Loader2, { size: 14, className: "animate-spin" }) : _jsx(LogIn, { size: 14 }), loading ? "Signing in…" : "Sign in"] })] }), _jsxs("div", { className: "mt-6 pt-6 border-t border-ink-100", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wider font-semibold text-ink-400 mb-2", children: "Demo accounts (password: ChangeMe!123)" }), _jsx("div", { className: "grid grid-cols-2 gap-1.5", children: DEMO_USERS.map((u) => (_jsxs("button", { onClick: () => { setEmail(u.email); setPassword("ChangeMe!123"); }, className: "text-left p-2 rounded-lg hover:bg-ink-50 transition", children: [_jsx("div", { className: "text-xs font-medium text-ink-700", children: u.label }), _jsx("div", { className: "text-[11px] text-ink-500 truncate", children: u.email })] }, u.email))) })] })] })] }) })] }));
}
function Feature({ icon, label }) {
    return (_jsxs("div", { className: "rounded-xl bg-white/10 ring-1 ring-white/20 px-3 py-2 backdrop-blur", children: [_jsx("div", { className: "text-white/90", children: icon }), _jsx("div", { className: "text-xs mt-1.5 text-white/85", children: label })] }));
}
