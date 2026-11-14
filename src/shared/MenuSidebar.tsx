import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  BookOpen,
  Cookie,
  FileDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  MessageCircle,
  Settings,
  Settings2,
  Sparkles,
  Trash2,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { menuConfig } from "./menu";

const menuIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  ผู้ใช้งาน: UsersRound,
  บริการลูกค้า: MessageCircle,
  ประกาศ: Megaphone,
  เคลียร์ข้อมูลผู้ใช้: Trash2,
  ภาพรวมงบประมาณ: LayoutDashboard,
  ทะเบียนคุมเงิน: BookOpen,
  "รายรับ–รายจ่าย": ArrowRightLeft,
  ใบสำคัญและหลักฐาน: FileText,
  สัญญาการยืมเงิน: FileText,
  โครงการ: FolderKanban,
  ส่งออกทะเบียน: FileDown,
  จัดแบบฟอร์มรายงาน: Settings2,
  ติดต่อเรา: MessageCircle,
  "ผู้ช่วย AI": Sparkles,
};

type NotificationPreferences = {
  inApp: boolean;
  browser: boolean;
};
const notificationPreferencesKey = "thaiteacher-notification-preferences";
function readNotificationPreferences(): NotificationPreferences {
  const saved = localStorage.getItem(notificationPreferencesKey);
  if (!saved) return { inApp: true, browser: false };
  try {
    const preferences = JSON.parse(saved) as Partial<NotificationPreferences>;
    return {
      inApp: preferences.inApp !== false,
      browser: preferences.browser === true,
    };
  } catch (error) {
    console.error("Failed to read notification preferences", error);
    return { inApp: true, browser: false };
  }
}

type MenuProps = {
  active: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
  displayName: string;
  accessLabel: string;
  accessState: "trial" | "paid" | "lifetime" | "expired";
  onSignOut: () => void;
  isSupperAdmin: boolean;
  viewingUserName?: string | null;
  isDemo?: boolean;
  showTour?: boolean;
  unreadChatCount?: number;
};

function Menu({
  active,
  onNavigate,
  mobileOpen,
  onClose,
  displayName,
  accessLabel,
  accessState,
  onSignOut,
  isSupperAdmin,
  viewingUserName,
  isDemo = false,
  showTour = true,
  unreadChatCount = 0,
}: MenuProps) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsListOpen, setSettingsListOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [notificationPreferences, setNotificationPreferences] = useState(
    readNotificationPreferences,
  );
  useEffect(() => {
    if (!confirmSignOut && !settingsOpen && !settingsListOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmSignOut(false);
        setSettingsOpen(false);
        setSettingsListOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [confirmSignOut, settingsOpen, settingsListOpen]);
  useEffect(() => {
    if (!settingsListOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !settingsMenuRef.current?.contains(event.target)
      )
        setSettingsListOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [settingsListOpen]);
  useEffect(() => {
    localStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify(notificationPreferences),
    );
  }, [notificationPreferences]);
  const nav = (p: string) => {
    onNavigate(p);
    setSettingsListOpen(false);
    onClose();
  };
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="ปิดเมนู"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden print:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 print:hidden flex w-64 flex-col border-r border-blue-100 bg-gradient-to-b from-white via-white to-blue-50 px-4 py-5 shadow-xl shadow-slate-900/5 transition-transform duration-300 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="mb-6 flex shrink-0 items-start gap-2 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <img
              src="/haiteacher-brand.png"
              alt="HaiTeacher ให้ทุกวันของครูง่ายขึ้น"
              className="h-auto w-full object-contain"
            />
          </div>

          <button
            className="shrink-0 text-slate-400 dark:text-slate-500 lg:hidden"
            onClick={onClose}
            aria-label="ปิดเมนู"
          >
            ×
          </button>
        </div>

        {/* Navigation */}
        <nav className="min-h-0 w-full flex-1 space-y-1 overflow-x-hidden overflow-y-auto">
          {isSupperAdmin && viewingUserName && (
            <p className="px-3 pt-3 text-[11px] font-semibold text-blue-600 dark:text-blue-300">
              กำลังสวมสิทธิ์ {viewingUserName}
            </p>
          )}

          {menuConfig
            .filter(
              ({ role }) =>
                (role === "teacher" &&
                  (!isSupperAdmin || Boolean(viewingUserName))) ||
                (role === "superAdmin" && isSupperAdmin),
            )
            .filter(
              ({ label, hidden }) =>
                !hidden && label !== "ผู้ช่วย AI" && label !== "ติดต่อเรา",
            )
            .map(({ label }) => {
              const Icon = menuIcons[label] || Wallet;
              return (
                <button
                  key={label}
                  data-tour={
                    label === "ภาพรวมงบประมาณ" ? "sidebar-overview" : undefined
                  }
                  onClick={() => nav(label)}
                  aria-current={active === label ? "page" : undefined}
                  className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] motion-safe:transition-all motion-safe:duration-200 ${
                    active === label
                      ? "bg-gradient-to-r from-blue-600 to-sky-600 font-semibold text-white shadow-md shadow-blue-200/70 dark:shadow-blue-950/30"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon
                      size={17}
                      strokeWidth={1.9}
                      className="motion-safe:transition-transform motion-safe:group-hover:scale-110"
                    />
                  </span>
                  <span>
                    {label === "ผู้ใช้งาน" ? "จัดการผู้ใช้งาน" : label}
                  </span>
                </button>
              );
            })}
        </nav>
        <div
          ref={settingsMenuRef}
          className="relative shrink-0 border-t border-slate-200 pt-3 dark:border-slate-800"
        >
          {settingsListOpen && (
            <div
              id="sidebar-settings-list"
              aria-label="การตั้งค่าบัญชี"
              className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(24rem,65dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="px-3 pb-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                บัญชีและการตั้งค่า
              </p>
              {!isDemo && (
                <button
                  type="button"
                  onClick={() => nav("โปรไฟล์บัญชี")}
                  aria-current={active === "โปรไฟล์บัญชี" ? "page" : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] hover:bg-blue-50 dark:hover:bg-slate-800 ${active === "โปรไฟล์บัญชี" ? "bg-blue-100 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`}
                >
                  <UsersRound size={17} /> แก้ไขโปรไฟล์
                </button>
              )}
              {!isSupperAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => nav("ติดต่อเรา")}
                    aria-current={active === "ติดต่อเรา" ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] hover:bg-blue-50 dark:hover:bg-slate-800 ${active === "ติดต่อเรา" ? "bg-blue-100 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    <MessageCircle size={17} /> ติดต่อเรา
                    {unreadChatCount > 0 && (
                      <span
                        className="ml-auto size-2.5 rounded-full bg-red-500"
                        aria-label="มีข้อความใหม่"
                      />
                    )}
                  </button>
                  {showTour && (
                    <button
                      type="button"
                      onClick={() => {
                        setSettingsListOpen(false);
                        onClose();
                        window.dispatchEvent(
                          new Event("thaiteacher:start-tour"),
                        );
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <BookOpen size={17} /> สอนการใช้งาน
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setSettingsListOpen(false);
                  onClose();
                  setSettingsOpen(true);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Settings2 size={17} /> ตั้งค่าการแจ้งเตือน
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsListOpen(false);
                  onClose();
                  window.dispatchEvent(new Event("thaiteacher:open-legal"));
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-slate-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Cookie size={17} /> คุกกี้และข้อตกลง
              </button>
              {!isDemo && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsListOpen(false);
                    onClose();
                    setConfirmSignOut(true);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                >
                  <LogOut size={17} /> ออกจากระบบ
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-800">
            {isDemo ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <LogIn size={16} /> เข้าสู่ระบบ
              </button>
            ) : (
              <button
                type="button"
                onClick={() => nav("โปรไฟล์บัญชี")}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left hover:bg-blue-50 dark:hover:bg-slate-700"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-semibold text-orange-800">
                  {displayName.trim().charAt(0) || "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[11px] text-slate-700 dark:text-slate-200">
                    {displayName}
                  </b>
                  <small
                    className={`block text-[10px] leading-4 ${accessState === "trial" ? "text-blue-600 dark:text-blue-300" : accessState === "paid" || accessState === "lifetime" ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}
                  >
                    {accessLabel}
                  </small>
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsListOpen((open) => !open)}
              aria-label="เปิดรายการตั้งค่า"
              aria-controls="sidebar-settings-list"
              aria-expanded={settingsListOpen}
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${settingsListOpen ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-slate-500 hover:bg-blue-50 dark:hover:bg-slate-700"}`}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>
      {confirmSignOut &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setConfirmSignOut(false);
            }}
          >
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="signout-title"
              aria-describedby="signout-description"
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  <LogOut size={23} />
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(false)}
                  aria-label="ปิดหน้าต่าง"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
              <h2 id="signout-title" className="mt-5 text-xl font-bold">
                ออกจากระบบ?
              </h2>
              <p
                id="signout-description"
                className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
              >
                คุณจะต้องเข้าสู่ระบบอีกครั้งเมื่อต้องการใช้งานบัญชีนี้
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmSignOut(false)}
                  className="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmSignOut(false);
                    onSignOut();
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  ออกจากระบบ
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
      {settingsOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSettingsOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    ตั้งค่าการแจ้งเตือน
                  </p>
                  <h2 id="settings-title" className="mt-1 text-xl font-bold">
                    การตั้งค่า
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="ปิดการตั้งค่า"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-5 border-b border-slate-200 dark:border-slate-700">
                <span className="inline-flex border-b-2 border-blue-600 px-2 pb-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                  ตั้งค่าการแจ้งเตือน
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block text-sm font-medium">
                      แจ้งเตือนในแอป
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      แสดงรายการแจ้งเตือนภายในระบบ
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.inApp}
                    onChange={(event) =>
                      setNotificationPreferences((current) => ({
                        ...current,
                        inApp: event.target.checked,
                      }))
                    }
                    className="size-4 shrink-0 accent-blue-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block text-sm font-medium">
                      แจ้งเตือนบนเบราว์เซอร์
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      แสดงการแจ้งเตือนขณะเปิดเว็บ
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.browser}
                    onChange={(event) =>
                      setNotificationPreferences((current) => ({
                        ...current,
                        browser: event.target.checked,
                      }))
                    }
                    className="size-4 shrink-0 accent-blue-600"
                  />
                </label>
                <div className="flex items-center justify-between gap-4 py-4">
                  <span>
                    <span className="block text-sm font-medium text-slate-400">
                      Push เมื่อปิดเว็บ
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      ต้องเชื่อมต่อระบบฝั่งเซิร์ฟเวอร์ก่อน
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                    ยังไม่พร้อม
                  </span>
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

export default Menu;
