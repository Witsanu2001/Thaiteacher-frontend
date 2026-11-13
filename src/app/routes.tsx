import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { User } from "firebase/auth";
import type { UserProfile } from "../config/services/users.service";
import SchoolFinancePage from "../modules/schoolFinance/SchoolFinancePage";
import { useFinancePage } from "../modules/schoolFinance/financePageState";
import MoneyRegisterPage from "../modules/money-register/MoneyRegisterPage";
import IncomeExpensePage from "../modules/income-expense/IncomeExpensePage";
import VoucherEvidencePage from "../modules/vouchers/VoucherEvidencePage";
import LoanContractsPage from "../modules/loan-contracts/LoanContractsPage";
import ProjectWorkspacePage from "../modules/projects/ProjectWorkspacePage";
import ExportArchivePage from "../modules/exports/ExportArchivePage";
import ReportFormSettingsPage from "../modules/report-form/ReportFormSettingsPage";
import AdminDashboardPage from "../modules/admin-dashboard/AdminDashboardPage";
import AdminUsersPage from "../modules/admin-users/AdminUsersPage";
import AdminClearPage from "../modules/admin-clear/AdminClearPage";
import AdminSupportPage from "../modules/admin-support/AdminSupportPage";
import AdminAnnouncementsPage from "../modules/admin-announcements/AdminAnnouncementsPage";
import ContactPage from "../modules/contact/ContactPage";
import ChatGiminiAIPage from "../modules/gimini-ai/ChatGiminiAIPage";
import AdminHeader from "../shared/components/AdminHeader";

function Overview() {
  return useFinancePage().overview;
}
function Register() {
  const value = useFinancePage();
  return (
    <MoneyRegisterPage
      school={value.school}
      reports={value.yearReports}
      fiscalYear={value.fiscalYear}
      user={value.user}
      viewAsUid={value.viewAsUid}
      demo={value.demo}
      onNavigate={(category) =>
        value.onNavigate("รายรับ–รายจ่าย", category)
      }
    />
  );
}
function IncomeExpense() {
  const value = useFinancePage();
  const location = useLocation();
  const routeState = location.state;
  const initialCategory =
    routeState &&
    typeof routeState === "object" &&
    "incomeExpenseCategory" in routeState &&
    typeof routeState.incomeExpenseCategory === "string"
      ? routeState.incomeExpenseCategory
      : undefined;
  return (
    <IncomeExpensePage
      key={value.schoolKey}
      school={value.school}
      categories={value.categories}
      fiscalYear={value.fiscalYear}
      reports={value.allReports}
      initialCategory={initialCategory}
      user={value.user}
      viewAsUid={value.viewAsUid}
      demo={value.demo}
    />
  );
}
function Vouchers() {
  const value = useFinancePage();
  return (
    <VoucherEvidencePage
      school={value.school}
      fiscalYear={value.fiscalYear}
      onNavigate={() => value.onNavigate("รายรับ–รายจ่าย")}
      user={value.user}
      viewAsUid={value.viewAsUid}
      demo={value.demo}
    />
  );
}
function LoanContracts() {
  const value = useFinancePage();
  return <LoanContractsPage key={value.schoolKey} school={value.school} reports={value.allReports} user={value.user} viewAsUid={value.viewAsUid} demo={value.demo} />;
}
function Exports() {
  const value = useFinancePage();
  return (
    <ExportArchivePage
      school={value.school}
      reports={value.allReports}
      user={value.user}
      viewAsUid={value.viewAsUid}
      demo={value.demo}
      onPreviewCurrent={value.onPreview}
    />
  );
}
function ReportForm() {
  const value = useFinancePage();
  return (
    <ReportFormSettingsPage
      school={value.school}
      date={value.reportFormDate}
      onPreview={value.onPreview}
    />
  );
}

export default function AppRoutes({
  user,
  isAdmin = false,
  aiAllowed = false,
  viewing,
  profileSchoolName,
  onMenu,
  dark,
  onToggleDark,
  onNavigate,
  onManage,
  onView,
  viewBusy = false,
  demo = false,
  onLogin,
}: {
  user?: User;
  isAdmin?: boolean;
  aiAllowed?: boolean;
  viewing?: UserProfile | null;
  profileSchoolName: string;
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onNavigate: (page: string, incomeExpenseCategory?: string) => void;
  onManage?: () => void;
  onView?: (profile: UserProfile) => void;
  viewBusy?: boolean;
  demo?: boolean;
  onLogin?: () => void;
}) {
  const finance = !isAdmin || Boolean(viewing);
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={
              isAdmin && !viewing
                ? "/admin/dashboard"
                : "/finance/school-finance"
            }
            replace
          />
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          isAdmin && user ? (
            <AdminDashboardPage
              user={user}
              onMenu={onMenu}
              onManage={onManage || (() => onNavigate("ผู้ใช้งาน"))}
              dark={dark}
              onToggleDark={onToggleDark}
            />
          ) : (
            <Navigate to="/finance/school-finance" replace />
          )
        }
      />
      <Route
        path="/admin/users"
        element={
          isAdmin && user && onView ? (
            <AdminUsersPage
              user={user}
              onMenu={onMenu}
              onView={onView}
              viewBusy={viewBusy}
              dark={dark}
              onToggleDark={onToggleDark}
            />
          ) : (
            <Navigate to="/finance/school-finance" replace />
          )
        }
      />
      <Route
        path="/admin/clear-users"
        element={isAdmin && user ? <AdminClearPage user={user} onMenu={onMenu} dark={dark} onToggleDark={onToggleDark} /> : <Navigate to="/finance/school-finance" replace />}
      />
      <Route
        path="/admin/support"
        element={isAdmin && user ? <AdminSupportPage user={user} onMenu={onMenu} dark={dark} onToggleDark={onToggleDark} /> : <Navigate to="/finance/school-finance" replace />}
      />
      <Route
        path="/admin/announcements"
        element={isAdmin && user ? <AdminAnnouncementsPage user={user} onMenu={onMenu} dark={dark} onToggleDark={onToggleDark} /> : <Navigate to="/finance/school-finance" replace />}
      />
      <Route
        path="/admin/gimini-ai"
        element={
          isAdmin && user ? (
            <div className="flex h-dvh min-h-screen flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
              <AdminHeader
                title="ผู้ช่วย AI"
                onMenu={onMenu}
                dark={dark}
                onToggleDark={onToggleDark}
              />
              <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
                <ChatGiminiAIPage getAccessToken={() => user.getIdToken()} storageKey={user.uid} />
              </main>
            </div>
          ) : (
            <Navigate to="/finance/school-finance" replace />
          )
        }
      />
      <Route
        path="/finance"
        element={
          finance ? (
            <SchoolFinancePage
              key={viewing?.uid || (demo ? "demo" : user?.uid)}
              user={user}
              viewAsUid={viewing?.uid}
              initialSchoolName={viewing?.schoolName || profileSchoolName}
              onMenu={onMenu}
              dark={dark}
              onToggleDark={onToggleDark}
              onNavigate={onNavigate}
              demo={demo}
              onLogin={onLogin}
              aiAllowed={aiAllowed}
            />
          ) : (
            <Navigate to="/admin/dashboard" replace />
          )
        }
      >
        <Route path="school-finance" element={<Overview />} />
        <Route path="money-register" element={<Register />} />
        <Route path="income-expense" element={<IncomeExpense />} />
        <Route path="vouchers" element={<Vouchers />} />
        <Route path="loan-contracts" element={<LoanContracts />} />
        <Route path="projects" element={<ProjectWorkspacePage />} />
        <Route path="exports" element={<Exports />} />
        <Route path="report-settings" element={<ReportForm />} />
        <Route path="contact" element={<ContactPage user={user} demo={demo} />} />
        <Route path="gimini-ai" element={aiAllowed && user && !demo ? <ChatGiminiAIPage key={`${user.uid}:${viewing?.uid || "self"}`} storageKey={`${user.uid}:${viewing?.uid || "self"}`} getAccessToken={() => user.getIdToken()} viewAsUid={viewing?.uid} /> : <Navigate to="/finance/school-finance" replace />} />
      </Route>
      <Route
        path="*"
        element={
          <Navigate
            to={
              isAdmin && !viewing
                ? "/admin/dashboard"
                : "/finance/school-finance"
            }
            replace
          />
        }
      />
    </Routes>
  );
}
