import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { useTenantStore } from "./store/tenant";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DoctorDashboardPage } from "./pages/DoctorDashboardPage";
import { ConsultationPage } from "./pages/ConsultationPage";
import { PatientsPage } from "./pages/PatientsPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { BookAppointmentPage } from "./pages/BookAppointmentPage";
import { DoctorsPage } from "./pages/DoctorsPage";
import { KycReviewPage } from "./pages/KycReviewPage";
import { InsurancePage } from "./pages/InsurancePage";
import { AiChatPage } from "./pages/AiChatPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";
import { TenantSettingsPage } from "./pages/TenantSettingsPage";
import { TenantsPage } from "./pages/TenantsPage";
import { PriceListPage } from "./pages/PriceListPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceDetailPage } from "./pages/InvoiceDetailPage";
import { SpecialtiesPage } from "./pages/SpecialtiesPage";
import { InsuranceCompaniesPage } from "./pages/InsuranceCompaniesPage";
import { InstallPrompt } from "./components/InstallPrompt";
function HomeDashboard() {
    const roles = useAuthStore((s) => s.user?.roles || []);
    if (roles.includes("doctor"))
        return _jsx(DoctorDashboardPage, {});
    return _jsx(DashboardPage, {});
}
function TenantBootstrap() {
    const fetchTenant = useTenantStore((s) => s.fetch);
    useEffect(() => { fetchTenant(); }, [fetchTenant]);
    return null;
}
function Protected({ children }) {
    const token = useAuthStore((s) => s.accessToken);
    const navigate = useNavigate();
    useEffect(() => {
        if (!token)
            navigate("/login", { replace: true });
    }, [token, navigate]);
    if (!token)
        return null;
    return _jsx(_Fragment, { children: children });
}
export default function App() {
    return (_jsxs(_Fragment, { children: [_jsx(TenantBootstrap, {}), _jsx(InstallPrompt, {}), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/*", element: _jsx(Protected, { children: _jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomeDashboard, {}) }), _jsx(Route, { path: "/consult/:appointmentId", element: _jsx(ConsultationPage, {}) }), _jsx(Route, { path: "/patients", element: _jsx(PatientsPage, {}) }), _jsx(Route, { path: "/patients/:id", element: _jsx(PatientDetailPage, {}) }), _jsx(Route, { path: "/appointments", element: _jsx(AppointmentsPage, {}) }), _jsx(Route, { path: "/appointments/book", element: _jsx(BookAppointmentPage, {}) }), _jsx(Route, { path: "/doctors", element: _jsx(DoctorsPage, {}) }), _jsx(Route, { path: "/kyc", element: _jsx(KycReviewPage, {}) }), _jsx(Route, { path: "/insurance", element: _jsx(InsurancePage, {}) }), _jsx(Route, { path: "/reports", element: _jsx(ReportsPage, {}) }), _jsx(Route, { path: "/audit", element: _jsx(AuditPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(TenantSettingsPage, {}) }), _jsx(Route, { path: "/tenants", element: _jsx(TenantsPage, {}) }), _jsx(Route, { path: "/price-list", element: _jsx(PriceListPage, {}) }), _jsx(Route, { path: "/lookups/specialties", element: _jsx(SpecialtiesPage, {}) }), _jsx(Route, { path: "/lookups/insurance-companies", element: _jsx(InsuranceCompaniesPage, {}) }), _jsx(Route, { path: "/invoices", element: _jsx(InvoicesPage, {}) }), _jsx(Route, { path: "/invoices/:id", element: _jsx(InvoiceDetailPage, {}) }), _jsx(Route, { path: "/ai", element: _jsx(AiChatPage, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }) })] })] }));
}
