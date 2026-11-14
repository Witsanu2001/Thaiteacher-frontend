import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import Menu from "./MenuSidebar";
import AuthGate from "../features/auth/AuthGate";
import AppRoutes from "../app/routes";
import SupportChatNotifications from "./components/SupportChatNotifications";
import GuidedTour from "./components/GuidedTour";
import { loadAppState } from "../config/services/app-state.service";
import type { UserProfile } from "../config/services/users.service";
import {
  replaceScopedSnapshot,
  setViewingUser,
} from "./funtion/scopedStorage";
import {
  menuConfig,
  pageFromPath,
  pathForPage,
} from "./menu";
import { useRouteReveal } from "./funtion/useRouteReveal";

type AppProfile = Pick<UserProfile, "displayName" | "email" | "phone" | "position" | "schoolName" | "schoolId" | "dataVersion" | "role" | "tourCompleted">;
type AccessState = "trial" | "paid" | "lifetime" | "expired";

function AppContent({
  profile,
  user,
  accessLabel,
  accessState,
  onSignOut,
  onProfileSaved,
}: {
  profile: AppProfile;
  user: User;
  accessLabel: string;
  accessState: AccessState;
  onSignOut: () => void;
  onProfileSaved: (profile: UserProfile) => void;
}) {
  const isAdmin = profile.role === "supperAdmin";
  const location = useLocation();
  const routerNavigate = useNavigate();
  const active = pageFromPath(location.pathname, isAdmin);
  const contentRef = useRef<HTMLDivElement>(null);
  useRouteReveal(contentRef, location.pathname);
  const [viewing, setViewing] = useState<UserProfile | null>(null);
  const [viewError, setViewError] = useState("");
  const [viewBusy, setViewBusy] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [dark, setDark] = useState(
    () => localStorage.getItem("thaiteacher-theme") === "dark",
  );
  useEffect(() => {
    localStorage.setItem("thaiteacher-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (location.pathname === "/")
      routerNavigate(pathForPage(isAdmin ? "Dashboard" : "ภาพรวมงบประมาณ"), {
        replace: true,
      });
  }, [isAdmin, location.pathname, routerNavigate]);
  useEffect(() => {
    if (isAdmin && !viewing && location.pathname.startsWith("/finance/"))
      routerNavigate(pathForPage("Dashboard"), { replace: true });
  }, [isAdmin, location.pathname, routerNavigate, viewing]);

  const stopViewing = useCallback(() => {
    setViewingUser(null);
    setViewing(null);
    setViewError("");
  }, []);
  const navigate = useCallback((page: string, incomeExpenseCategory?: string) => {
    if (page === "Dashboard" || page === "ผู้ใช้งาน" || page === "เคลียร์ข้อมูลผู้ใช้" || (page === "โปรไฟล์บัญชี" && isAdmin)) stopViewing();
    const role =
      isAdmin &&
      menuConfig.some(
        (item) => item.label === page && item.role === "superAdmin",
      )
        ? "superAdmin"
        : "teacher";
    routerNavigate(pathForPage(page, role), {
      state: incomeExpenseCategory
        ? { incomeExpenseCategory }
        : null,
    });
  }, [isAdmin, routerNavigate, stopViewing]);
  const startViewing = async (target: UserProfile) => {
    if (
      !isAdmin ||
      target.uid === user.uid ||
      target.status === "clearing" ||
      target.status === "cleared"
    )
      return;
    setViewBusy(true);
    setViewError("");
    try {
      const state = await loadAppState(user, target.uid);
      const version = target.dataVersion || 0;
      replaceScopedSnapshot(target.uid, version, state);
      setViewingUser(target.uid, version);
      setViewing(target);
      routerNavigate(pathForPage("ภาพรวมงบประมาณ"));
      setMobileOpen(false);
    } catch {
      setViewError(
        "เข้าสวมสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบ users-service และลองใหม่",
      );
    } finally {
      setViewBusy(false);
    }
  };
  return (
    <div
      className={
        dark ? "dark min-h-screen print:min-h-0" : "min-h-screen print:min-h-0"
      }
    >
      <div className="min-h-screen bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-200 print:min-h-0 print:bg-white">
        <Menu active={active} onNavigate={navigate} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} displayName={profile.displayName} accessLabel={accessLabel} accessState={accessState} onSignOut={onSignOut} isSupperAdmin={isAdmin} viewingUserName={viewing ? (viewing.displayName || viewing.schoolName || viewing.email) : null} unreadChatCount={unreadChatCount} />
        {!isAdmin && (
          <SupportChatNotifications
            user={user}
            onUnreadCountChange={setUnreadChatCount}
          />
        )}
        <div ref={contentRef} className="lg:pl-64 print:pl-0">
          {viewError && (
            <p
              role="alert"
              className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            >
              {viewError}
            </p>
          )}
            <AppRoutes
              isAdmin={isAdmin}
              aiAllowed={isAdmin || accessState === "lifetime"}
              viewing={viewing}
              profileSchoolName={profile.schoolName}
              user={user}
              accountProfile={profile}
              onProfileSaved={onProfileSaved}
              onMenu={() => setMobileOpen(true)}
              dark={dark}
              onToggleDark={() => setDark((value) => !value)}
              onNavigate={navigate}
              onManage={() => navigate("ผู้ใช้งาน")}
              onView={startViewing}
              viewBusy={viewBusy}
            />
            {!isAdmin && <GuidedTour accountKey={user.uid} dark={dark} user={user} completedTours={profile.tourCompleted} />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      {(profile, accessLabel, accessState, onSignOut, user, onProfileSaved) => (
        <AppContent
          key={`${user.uid}:${profile.role}:${profile.schoolId || user.uid}:${profile.dataVersion || 0}`}
          profile={profile}
          user={user}
          accessLabel={accessLabel}
          accessState={accessState}
          onSignOut={onSignOut}
          onProfileSaved={onProfileSaved}
        />
      )}
    </AuthGate>
  );
}
