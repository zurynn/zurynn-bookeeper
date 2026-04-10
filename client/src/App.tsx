import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCompanyStore } from './store/companyStore';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import CreateCompanyPage from './pages/onboarding/CreateCompanyPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AccountsPage from './pages/accounts/AccountsPage';
import JournalPage from './pages/journal/JournalPage';
import CustomersPage from './pages/customers/CustomersPage';
import InvoicesPage from './pages/invoices/InvoicesPage';
import VendorsPage from './pages/vendors/VendorsPage';
import BillsPage from './pages/bills/BillsPage';
import BankingPage from './pages/banking/BankingPage';
import PnLPage from './pages/reports/PnLPage';
import BalanceSheetPage from './pages/reports/BalanceSheetPage';
import CashFlowPage from './pages/reports/CashFlowPage';
import TaxSummaryPage from './pages/reports/TaxSummaryPage';
import CompanySettingsPage from './pages/company/CompanySettingsPage';
import ExpensesPage from './pages/expenses/ExpensesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

// Redirects users who don't have a company yet to the onboarding page
function CompanyRequired({ children }: { children: React.ReactNode }) {
  const company = useCompanyStore((s) => s.company);
  return company ? <>{children}</> : <Navigate to="/onboarding/company" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Onboarding — authenticated but no company yet */}
      <Route
        path="/onboarding/company"
        element={<ProtectedRoute><CreateCompanyPage /></ProtectedRoute>}
      />

      {/* App routes — require auth + company */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <CompanyRequired>
              <AppShell />
            </CompanyRequired>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="banking" element={<BankingPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports/profit-loss" element={<PnLPage />} />
        <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="reports/cash-flow" element={<CashFlowPage />} />
        <Route path="reports/tax-summary" element={<TaxSummaryPage />} />
        <Route path="settings/company" element={<CompanySettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
