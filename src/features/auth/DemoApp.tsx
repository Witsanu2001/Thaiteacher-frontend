import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Menu from "../../shared/MenuSidebar";
import AppRoutes from "../../app/routes";
import { demoSchoolName, enterDemoScope } from "./demoFinanceStore";
import { pageFromPath, pathForPage } from "../../shared/menu";
import { useRouteReveal } from "../../shared/funtion/useRouteReveal";
import { Sparkles } from "lucide-react";
import GuidedTour from "../../shared/components/GuidedTour";
import type { User } from "firebase/auth";
import {
  markOnboarding,
  type UserProfile,
} from "../../config/services/users.service";

export default function DemoApp({
  onLogin,
  accountKey,
  user,
  completedTours,
  loginError,
}: {
  onLogin: () => void;
  accountKey?: string;
  user?: User;
  completedTours?: UserProfile["tourCompleted"];
  loginError?: string;
}) {
  useState(() => enterDemoScope());
  useEffect(() => {
    if (!user || !accountKey) return;
    localStorage.setItem(`thaiteacher-demo-seen:${accountKey}`, "1");
    void markOnboarding(user, "demo").catch((error) =>
      console.error("Could not save demo progress", error),
    );
  }, [accountKey, user]);
  const location = useLocation();
  const navigate = useNavigate();
  const active = pageFromPath(location.pathname);
  const contentRef = useRef<HTMLDivElement>(null);
  useRouteReveal(contentRef, location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(
    () => localStorage.getItem("thaiteacher-theme") === "dark",
  );
  useEffect(() => {
    localStorage.setItem("thaiteacher-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (location.pathname === "/")
      navigate(pathForPage("ภาพรวมงบประมาณ"), { replace: true });
  }, [location.pathname, navigate]);
  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <Menu
          active={active}
          onNavigate={(page) => navigate(pathForPage(page))}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          displayName="ผู้เข้าชม"
          accessLabel="โหมดตัวอย่าง"
          accessState="trial"
          onSignOut={onLogin}
          isSupperAdmin={false}
          isDemo
          showTour={Boolean(user)}
        />
        <div ref={contentRef} className="lg:pl-64">
          {loginError && !user && (
            <div
              role="alert"
              className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
            >
              {loginError}
            </div>
          )}
          {/* <div className="flex min-h-14 items-center gap-2 border-b border-blue-200 bg-gradient-to-r from-blue-50 via-sky-50 to-cyan-50 px-4 py-2 text-sm text-blue-900 dark:border-blue-900 dark:from-blue-950 dark:via-slate-900 dark:to-slate-900 dark:text-blue-100 sm:px-6">
            <Sparkles
              size={16}
              className="shrink-0 text-blue-600 motion-safe:animate-pulse dark:text-sky-300"
            />
            <span>
              <strong>โหมดตัวอย่าง</strong> · ลองแก้ไขได้
              ข้อมูลเก็บเฉพาะในเครื่องนี้
            </span>
          </div> */}
          <AppRoutes
            onMenu={() => setMobileOpen(true)}
            dark={dark}
            onToggleDark={() => setDark((value) => !value)}
            onNavigate={(page) => navigate(pathForPage(page))}
            profileSchoolName={demoSchoolName}
            demo
            onLogin={onLogin}
          />
          {user && accountKey && (
            <GuidedTour
              accountKey={accountKey}
              dark={dark}
              user={user}
              completedTours={completedTours}
            />
          )}
        </div>
      </div>
    </div>
  );
}
