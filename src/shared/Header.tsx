import { useTrialDays } from "./funtion/useTrialDays";
import { useNavigate } from "react-router-dom";
import { useBillingPrice, useFinanceReadOnly } from "./FinanceAccess";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, Moon, School, Sun, X } from "lucide-react";
import { firstDayOfFiscalYear } from "../shared/funtion/fiscalYear";
import NotificationBell from "./components/NotificationBell";
import AiHeaderButton from "./components/AiHeaderButton";

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
  aiAllowed?: boolean;
};
const PageTitle = ({ active }: { active: string }) => (
  <>
    <h1
      data-tour="page-title"
      title={active}
      className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-slate-800 dark:text-slate-100 sm:line-clamp-1 sm:text-xl xl:text-2xl"
    >
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
  aiAllowed = false,
}: HeaderProps) {
  const trialDays = useTrialDays();
  const readOnly = useFinanceReadOnly();
  const billingPrice = useBillingPrice();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [newYear, setNewYear] = useState(fiscalYear + 1);
  const [carry, setCarry] = useState(true);
  const [error, setError] = useState("");
  const [creatingYear, setCreatingYear] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const contextId = useId();
  useEffect(() => {
    if (!contextOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setContextOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [contextOpen]);
  const chooseYear = (value: string) => {
    setContextOpen(false);
    if (value === "new") {
      setNewYear(Math.max(...fiscalYears, fiscalYear) + 1);
      setCarry(true);
      setError("");
      if (!readOnly) setOpening(true);
    } else onFiscalYearChange(Number(value));
  };
  const yearOptions = (
    <>
      {fiscalYears.map((year) => (
        <option key={year} value={year}>
          ปีงบประมาณ {year}
        </option>
      ))}
      <option disabled={readOnly} value="new">+ เปิดปีงบประมาณใหม่…</option>
    </>
  );
  const submitYear = async () => {
    if (readOnly) return;
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
      <header ref={headerRef} data-app-header className="sticky top-0 z-30 shrink-0 border-b border-blue-100 bg-white px-3 py-2.5 shadow-sm shadow-blue-100/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:px-5 sm:py-3 print:hidden">
        <div className="flex min-h-11 min-w-0 items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => { setContextOpen(false); onMenu(); }} data-tour="menu-button" aria-label="เปิดเมนู" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 lg:hidden">
            <Menu size={23} />
          </button>
          <div className="min-w-0 flex-1">
            <PageTitle active={active} />
          {!demo ? <button type="button" data-tour="fiscal-year" aria-label="ข้อมูลโรงเรียนและปีงบประมาณ" aria-expanded={contextOpen} aria-controls={contextId} onClick={() => setContextOpen(value => !value)} className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 sm:hidden">
              <span className="truncate">ปีงบฯ {fiscalYear}</span><ChevronDown size={13} className="shrink-0" />
            </button> : <button type="button" onClick={onLogin} className="mt-0.5 text-xs font-semibold text-blue-600 dark:text-blue-300 sm:hidden">ทดลองใช้ {trialDays} วัน</button>}
          </div>
          {!demo ? <button type="button" data-tour="fiscal-year" aria-label="ข้อมูลโรงเรียนและปีงบประมาณ" aria-expanded={contextOpen} aria-controls={contextId} onClick={() => setContextOpen(value => !value)} className="hidden min-w-0 max-w-[280px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700 dark:hover:bg-slate-700 sm:flex md:max-w-[320px] lg:max-w-[240px] xl:max-w-[320px]">
            <School size={17} className="shrink-0 text-slate-400" />
            <span className="min-w-0 truncate font-medium text-slate-600 dark:text-slate-300" title={schoolName}>{schoolName || "โรงเรียนของคุณ"}</span>
            <span className="shrink-0 border-l border-slate-200 pl-2 font-semibold tabular-nums text-blue-700 dark:border-slate-600 dark:text-blue-300">{fiscalYear}</span>
            <ChevronDown size={15} className="shrink-0 text-slate-400" />
          </button> : <button type="button" data-tour="fiscal-year" onClick={onLogin} className="hidden shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:block">ทดลองใช้ {trialDays} วัน</button>}
            {readOnly && !demo && (
            <button
              type="button"
              onClick={() => navigate("/billing")}
              aria-label={billingPrice > 0 ? `ต่ออายุ ${billingPrice} บาท / เดือน` : "ตรวจสอบสิทธิ์บัญชีหลัก"}
              className="shrink-0 rounded-xl bg-blue-600 px-2.5 py-2 text-xs font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:px-4 sm:text-sm"
            >
              <span className="block sm:inline">{billingPrice > 0 ? "ต่ออายุ" : "ตรวจสอบสิทธิ์"}</span>{" "}
              <span className="block sm:inline">{billingPrice > 0 ? `${billingPrice.toLocaleString("th-TH", {maximumFractionDigits:2})} บาท / เดือน` : "จากบัญชีหลัก"}</span>
            </button>
          )}
          <div className="flex shrink-0 items-center gap-0.5 border-l border-slate-200 pl-1 dark:border-slate-700 sm:gap-1 sm:pl-2">
            {aiAllowed && !demo && <AiHeaderButton to="/finance/gimini-ai" />}
            <NotificationBell demo={demo} />
            <button type="button" onClick={onToggleDark} aria-label="เปลี่ยนธีม" title={dark ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"} className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800">
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        {contextOpen && !demo && <section id={contextId} role="dialog" aria-label="โรงเรียนและปีงบประมาณ" className="absolute left-3 right-3 top-full z-40 mt-2 rounded-2xl border border-blue-100 bg-white p-4 text-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:left-auto sm:right-5 sm:w-80">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-medium text-slate-500">โรงเรียนที่กำลังใช้งาน</p><p className="mt-1 break-words font-semibold">{schoolName || "ยังไม่ได้ตั้งค่าโรงเรียน"}</p></div>
            <button type="button" onClick={() => setContextOpen(false)} aria-label="ปิดข้อมูลโรงเรียน" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></button>
          </div>
          <label className="mt-4 block text-sm font-medium">ปีงบประมาณ
            <select aria-label="ปีงบประมาณ" value={fiscalYear} onChange={event => chooseYear(event.target.value)} className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 font-semibold text-blue-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              {yearOptions}
            </select>
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">เลือกปีเพื่อดูข้อมูล หรือเปิดปีงบประมาณใหม่</p>
        </section>}
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
