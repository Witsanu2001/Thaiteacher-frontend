import { useState } from "react";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import { firstDayOfFiscalYear } from "../shared/funtion/fiscalYear";

type HeaderProps = {
  active: string;
  schoolName?: string;
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
  fiscalYear: number;
  fiscalYears: number[];
  onFiscalYearChange: (year: number) => void;
  onCreateFiscalYear: (
    year: number,
    carry: boolean,
  ) => Promise<string | undefined>;
  demo?: boolean;
  onLogin?: () => void;
};
const PageTitle = ({ active }: { active: string }) => (
  <>
    <h1 className="flex items-center gap-3 truncate text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-3xl">
      <span aria-hidden="true" className="h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400 shadow-sm shadow-blue-300 dark:shadow-blue-900" />
      {active}
    </h1>
  </>
);
export default function Header({
  active,
  schoolName,
  onMenu,
  dark,
  onToggleDark,
  fiscalYear,
  fiscalYears,
  onFiscalYearChange,
  onCreateFiscalYear,
  demo = false,
  onLogin,
}: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [newYear, setNewYear] = useState(fiscalYear + 1);
  const [carry, setCarry] = useState(true);
  const [error, setError] = useState("");
  const [creatingYear, setCreatingYear] = useState(false);
  const chooseYear = (value: string) => {
    if (value === "new") {
      setNewYear(Math.max(...fiscalYears, fiscalYear) + 1);
      setCarry(true);
      setError("");
      setOpening(true);
    } else onFiscalYearChange(Number(value));
  };
  const yearOptions = (
    <>
      {fiscalYears.map((year) => (
        <option key={year} value={year}>
          ปีงบประมาณ {year}
        </option>
      ))}
      <option value="new">+ เปิดปีงบประมาณใหม่…</option>
    </>
  );
  const submitYear = async () => {
    if (!Number.isInteger(newYear) || newYear < 2500 || newYear > 2900) {
      setError("กรอกปีงบประมาณ พ.ศ. ให้ถูกต้อง");
      return;
    }
    if (fiscalYears.includes(newYear)) {
      setError("ปีงบประมาณนี้มีอยู่แล้ว");
      return;
    }
    setCreatingYear(true);
    const result = await onCreateFiscalYear(newYear, carry);
    setCreatingYear(false);
    if (result) {
      setError(result);
      return;
    }
    setOpening(false);
  };
  return (
    <>
      <header className="shrink-0 border-b border-blue-100 bg-gradient-to-r from-white via-white to-sky-50/70 px-4 py-3 shadow-sm shadow-blue-100/40 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 dark:shadow-none sm:px-6 lg:py-4 print:hidden">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 motion-safe:transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu size={22} />
          </button>
          <div className="hidden min-w-0 lg:block">
            <PageTitle active={active} />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <span
              className="max-w-[38vw] truncate rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-right text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 sm:max-w-[280px] sm:text-base lg:max-w-[200px] xl:max-w-[320px]"
              title={schoolName || ""}
            >
              {schoolName || "ยังไม่ได้ตั้งค่าโรงเรียน"}
            </span>
            {!demo ? <select
              aria-label="ปีงบประมาณ"
              value={fiscalYear}
              onChange={(e) => chooseYear(e.target.value)}
              className="hidden max-w-44 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200 lg:block"
            >
              {yearOptions}
            </select> : <button type="button" onClick={onLogin} className="hidden rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 motion-safe:transition-all hover:-translate-y-0.5 hover:shadow-lg dark:shadow-blue-950 lg:block">ทดลองใช้งาน 30 วัน</button>}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label="การแจ้งเตือน"
                aria-expanded={notificationsOpen}
                className="grid size-10 place-items-center rounded-xl text-slate-600 motion-safe:transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Bell size={20} />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 top-12 z-40 w-60 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  ไม่มีการแจ้งเตือนใหม่
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onToggleDark}
              aria-label="เปลี่ยนธีม"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 motion-safe:transition-all hover:-rotate-12 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex min-w-0 flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 lg:hidden">
          <div className="min-w-0">
            <PageTitle active={active} />
          </div>
          {!demo ? <select
            aria-label="ปีงบประมาณ"
            value={fiscalYear}
            onChange={(e) => chooseYear(e.target.value)}
            className="max-w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
          >
            {yearOptions}
          </select> : <button type="button" onClick={onLogin} className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 motion-safe:transition-transform hover:-translate-y-0.5 dark:shadow-blue-950">ทดลองใช้งาน 30 วัน</button>}
        </div>
      </header>
      {opening && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-year-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  ปีงบประมาณ
                </p>
                <h2 id="new-year-title" className="mt-1 text-xl font-semibold">
                  เปิดปีงบประมาณใหม่
                </h2>
              </div>
              <button onClick={() => setOpening(false)} aria-label="ปิด">
                <X size={20} />
              </button>
            </div>
            <label className="mt-5 grid gap-2 text-sm font-medium">
              ปีงบประมาณ พ.ศ.
              <input
                type="number"
                min="2500"
                max="2900"
                value={newYear}
                onChange={(e) => {
                  setNewYear(Number(e.target.value));
                  setError("");
                }}
                className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <p className="mt-2 text-sm text-slate-500">
              เริ่มวันที่{" "}
              {firstDayOfFiscalYear(newYear).split("-").reverse().join("/")} ถึง
              30/09/{newYear - 543}
            </p>
            <label className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm dark:bg-blue-950/40">
              <input
                type="checkbox"
                checked={carry}
                onChange={(e) => setCarry(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>ยกยอดคงเหลือจากรายงานล่าสุด</strong>
                <span className="mt-1 block text-slate-500 dark:text-slate-300">
                  สร้างรายงานวันแรกของปีใหม่ และเว้นหมายเหตุให้กรอกใหม่
                </span>
              </span>
            </label>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setOpening(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 dark:border-slate-700"
              >
                ยกเลิก
              </button>
              <button
                onClick={submitYear}
                disabled={creatingYear}
                className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white"
              >
                {creatingYear ? "กำลังเปิด…" : "เปิดปีงบประมาณ"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
