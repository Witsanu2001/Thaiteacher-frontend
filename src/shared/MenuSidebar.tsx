
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, BookOpen, FileDown, FileText, LayoutDashboard, LogIn, LogOut, MessageCircle, Settings2, Sparkles, Trash2, UsersRound, Wallet, X, type LucideIcon } from "lucide-react";
import { menuConfig } from "./menu";

const menuIcons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard,
  "ผู้ใช้งาน": UsersRound,
  "บริการลูกค้า": MessageCircle,
  "เคลียร์ข้อมูลผู้ใช้": Trash2,
  "ภาพรวมงบประมาณ": LayoutDashboard,
  "ทะเบียนคุมเงิน": BookOpen,
  "รายรับ–รายจ่าย": ArrowRightLeft,
  "ใบสำคัญและหลักฐาน": FileText,
  "ส่งออกทะเบียน": FileDown,
  "จัดแบบฟอร์มรายงาน": Settings2,
  "ติดต่อเรา": MessageCircle,
  "ผู้ช่วย AI": Sparkles,
};

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
}: MenuProps) {
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  useEffect(() => {
    if (!confirmSignOut) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmSignOut(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [confirmSignOut]);
  const nav = (p: string) => {
    onNavigate(p);
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
        className={`fixed inset-y-0 left-0 z-40 print:hidden flex w-64 flex-col border-r border-blue-100 bg-gradient-to-b from-white via-white to-blue-50/70 px-4 py-5 shadow-xl shadow-slate-900/5 transition-transform duration-300 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 lg:translate-x-0 ${
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
              return (
              <button
                key={label}
                onClick={() => nav(label)}
                aria-current={active === label ? "page" : undefined}
                className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] motion-safe:transition-all motion-safe:duration-200 ${
                  active === label
                    ? "bg-gradient-to-r from-blue-600 to-sky-600 font-semibold text-white shadow-md shadow-blue-200/70 dark:shadow-blue-950/30"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={1.9} className="shrink-0 motion-safe:transition-transform motion-safe:group-hover:scale-110" />
                <span>{label === "ผู้ใช้งาน" ? "จัดการผู้ใช้งาน" : label}</span>
              </button>
              );
            })}
        </nav>

        {/* Bottom Section: AI + User Profile */}
        <div className="mt-auto flex shrink-0 flex-col gap-3 pt-3">
          {(isSupperAdmin || accessState === "lifetime") && <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-3 shadow-sm dark:border-violet-900 dark:from-violet-950/50 dark:to-slate-900">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
              <Sparkles size={14} />
              ผู้ช่วย AI
            </div>
            <p className="my-1 text-[10px] leading-4 text-violet-600 dark:text-violet-300">
              ตรวจทะเบียนและค้นหาความผิดปกติ
            </p>
            <button
              type="button"
              onClick={() => nav("ผู้ช่วย AI")}
              aria-current={active === "ผู้ช่วย AI" ? "page" : undefined}
              className="mt-1 text-[10px] font-semibold text-violet-700 hover:underline dark:text-violet-300"
            >
              เปิดผู้ช่วย ↗
            </button>
          </div>}
          {/* User Profile */}
          <div className={isDemo ? "rounded-2xl" : "flex items-center gap-2 rounded-2xl border border-slate-100 bg-white/80 p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-800/60"}>
            {!isDemo && <>
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
            </>}

            <button
              type="button"
              onClick={() => isDemo ? onSignOut() : setConfirmSignOut(true)}
              aria-label={isDemo ? "เข้าสู่ระบบ" : "ออกจากระบบ"}
              title={isDemo ? "เข้าสู่ระบบ" : "ออกจากระบบ"}
              className={isDemo
                ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                : "rounded-lg p-2 text-slate-400 motion-safe:transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"}
            >
              {isDemo ? <><LogIn size={16} /> เข้าสู่ระบบ</> : <LogOut size={16} />}
            </button>
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
    </>
  );
}

export default Menu;
