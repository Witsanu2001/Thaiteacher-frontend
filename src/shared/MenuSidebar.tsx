
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, BookOpen, Cookie, FileDown, FileText, FolderKanban, LayoutDashboard, LogIn, LogOut, Megaphone, MessageCircle, Settings, Settings2, Sparkles, Trash2, UsersRound, Wallet, X, type LucideIcon } from "lucide-react";
import { menuConfig } from "./menu";

const menuIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  "ผู้ใช้งาน": UsersRound,
  "บริการลูกค้า": MessageCircle,
  "ประกาศ": Megaphone,
  "เคลียร์ข้อมูลผู้ใช้": Trash2,
  "ภาพรวมงบประมาณ": LayoutDashboard,
  "ทะเบียนคุมเงิน": BookOpen,
  "รายรับ–รายจ่าย": ArrowRightLeft,
  "ใบสำคัญและหลักฐาน": FileText,
  "สัญญาการยืมเงิน": FileText,
  "โครงการ": FolderKanban,
  "ส่งออกทะเบียน": FileDown,
  "จัดแบบฟอร์มรายงาน": Settings2,
  "ติดต่อเรา": MessageCircle,
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
  unreadChatCount = 0,
}: MenuProps) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountMenuMounted, setAccountMenuMounted] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    readNotificationPreferences,
  );
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmSignOut && !settingsOpen && !accountMenuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmSignOut(false);
        setSettingsOpen(false);
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [accountMenuOpen, confirmSignOut, settingsOpen]);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !accountMenuRef.current?.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [accountMenuOpen]);
  useEffect(() => {
    localStorage.setItem(
      notificationPreferencesKey,
      JSON.stringify(notificationPreferences),
    );
  }, [notificationPreferences]);
  useEffect(() => {
    if (accountMenuOpen || !accountMenuMounted) return;
    const timeout = window.setTimeout(
      () => setAccountMenuMounted(false),
      200,
    );
    return () => window.clearTimeout(timeout);
  }, [accountMenuMounted, accountMenuOpen]);
  const nav = (p: string) => {
    onNavigate(p);
    onClose();
  };
  const toggleAccountMenu = () => {
    if (accountMenuOpen) {
      setAccountMenuOpen(false);
      return;
    }
    setAccountMenuMounted(true);
    window.requestAnimationFrame(() => setAccountMenuOpen(true));
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
            .filter(({ label }) => label !== "ผู้ช่วย AI")
            .map(({ label }) => {
              const Icon = menuIcons[label] || Wallet;
              const hasUnreadChat = label === "ติดต่อเรา" && unreadChatCount > 0;
              return (
              <button
                key={label}
                data-tour={label === "ภาพรวมงบประมาณ" ? "sidebar-overview" : undefined}
                onClick={() => nav(label)}
                aria-current={active === label ? "page" : undefined}
                aria-label={hasUnreadChat ? `${label} มีข้อความใหม่` : undefined}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] motion-safe:transition-all motion-safe:duration-200 ${
                  active === label
                    ? "bg-gradient-to-r from-blue-600 to-sky-600 font-semibold text-white shadow-md shadow-blue-200/70 dark:shadow-blue-950/30"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <span className="relative shrink-0">
                  <Icon size={17} strokeWidth={1.9} className="motion-safe:transition-transform motion-safe:group-hover:scale-110" />
                  {hasUnreadChat && (
                    <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </span>
                <span>{label === "ผู้ใช้งาน" ? "จัดการผู้ใช้งาน" : label}</span>
              </button>
              );
            })}
        </nav>
        <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("thaiteacher:start-tour"))}
            className="mt-3 flex min-h-11 w-full shrink-0 items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            <BookOpen size={17} /> สอนการใช้งาน
          </button>

        {/* User Profile */}
        <div className="mt-auto flex shrink-0 flex-col gap-3 pt-3">
          {/* User Profile */}
          <div
            ref={accountMenuRef}
            className={isDemo ? "rounded-2xl" : "relative"}
          >
            {!isDemo ? (
            <button
              type="button"
              onClick={toggleAccountMenu}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              className="flex w-full items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 text-left shadow-sm hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-semibold text-orange-800">
                {displayName.trim().charAt(0) || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[11px] text-slate-700 dark:text-slate-200">
                  {displayName}
                </b>
                <small
                  className={`block text-[10px] leading-4 ${
                    accessState === "trial"
                      ? "text-blue-600 dark:text-blue-300"
                      : accessState === "paid" || accessState === "lifetime"
                        ? "text-emerald-600 dark:text-emerald-300"
                        : "text-amber-600 dark:text-amber-300"
                  }`}
                >
                  {accessLabel}
                </small>
              </span>
              <Settings
                size={16}
                aria-hidden="true"
                className={`shrink-0 text-slate-400 motion-safe:transition-transform motion-safe:duration-500 ${
                  accountMenuOpen ? "rotate-[360deg]" : "rotate-0"
                }`}
              />
            </button>
            ) : (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <LogIn size={16} />
                เข้าสู่ระบบ
              </button>
            )}
            {accountMenuMounted && !isDemo && (
              <div
                role="menu"
                aria-label="เมนูบัญชีผู้ใช้"
                className={`absolute bottom-full left-0 right-0 z-50 mb-2 origin-bottom overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 ${
                  accountMenuOpen
                    ? "translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none translate-y-2 scale-95 opacity-0"
                }`}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                >
                  <Settings2 size={16} />
                  ตั้งค่าระบบ
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    window.dispatchEvent(new Event("thaiteacher:open-legal"));
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                >
                  <Cookie size={16} />
                  คุกกี้และข้อตกลง
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setConfirmSignOut(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950"
                >
                  <LogOut size={16} />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {confirmSignOut && createPortal(
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSignOut(false); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="signout-title" aria-describedby="signout-description" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><LogOut size={23} /></span>
              <button type="button" onClick={() => setConfirmSignOut(false)} aria-label="ปิดหน้าต่าง" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <h2 id="signout-title" className="mt-5 text-xl font-bold">ออกจากระบบ?</h2>
            <p id="signout-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">คุณจะต้องเข้าสู่ระบบอีกครั้งเมื่อต้องการใช้งานบัญชีนี้</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" autoFocus onClick={() => setConfirmSignOut(false)} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">ยกเลิก</button>
              <button type="button" onClick={() => { setConfirmSignOut(false); onSignOut(); }} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">ออกจากระบบ</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
      {settingsOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm print:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-settings-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  การตั้งค่า
                </p>
                <h2
                  id="notification-settings-title"
                  className="mt-1 text-xl font-bold"
                >
                  ตั้งค่าการแจ้งเตือน
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
