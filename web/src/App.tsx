import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { initNative } from "./core/native-init";
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
  if (roles.includes("doctor")) return <DoctorDashboardPage />;
  return <DashboardPage />;
}

function TenantBootstrap() {
  const fetchTenant = useTenantStore((s) => s.fetch);
  useEffect(() => { fetchTenant(); }, [fetchTenant]);
  return null;
}

function NativeBootstrap() {
  const navigate = useNavigate();
  useEffect(() => {
    initNative(
      (path) => navigate(path),
      () => {
        // Pop one entry off React Router history if possible.
        if (window.history.length > 1) {
          window.history.back();
          return true;
        }
        return false;
      },
    );
  }, [navigate]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);
  if (!token) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
    <NativeBootstrap />
    <TenantBootstrap />
    <InstallPrompt />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<HomeDashboard />} />
                <Route path="/consult/:appointmentId" element={<ConsultationPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/appointments/book" element={<BookAppointmentPage />} />
                <Route path="/doctors" element={<DoctorsPage />} />
                <Route path="/kyc" element={<KycReviewPage />} />
                <Route path="/insurance" element={<InsurancePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="/settings" element={<TenantSettingsPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/price-list" element={<PriceListPage />} />
                <Route path="/lookups/specialties" element={<SpecialtiesPage />} />
                <Route path="/lookups/insurance-companies" element={<InsuranceCompaniesPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
                <Route path="/ai" element={<AiChatPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
    </>
  );
}
