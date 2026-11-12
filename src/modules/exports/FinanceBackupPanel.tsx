import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { AlertTriangle, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import { thaiDate } from "../../shared/funtion/thaiDate";
import { fiscalYearOf, todayIso } from "../../shared/funtion/fiscalYear";
import { scopedStorage } from "../../shared/funtion/scopedStorage";
import type { CashbookEntry, DailyReport } from "../../shared/funtion/types";
import { loadBudgetReports, saveBudgetReports } from "../../config/services/budget-reports.service";
import { loadAppState, writeAppState } from "../../config/services/app-state.service";
import { loadDemoReports, saveDemoReports } from "../../features/auth/demoFinanceStore";
import { buildFinanceBackup, parseFinanceBackup, type BackupVoucher, type FinanceBackup } from "./financeBackupWorkbook";

type Voucher = BackupVoucher & { attachments?: { name: string; data: string }[] };
type Current = { reports: DailyReport[]; entries: CashbookEntry[]; vouchers: Record<string, Voucher>; opening: Record<string, number>; appState: Record<string, string> };
type Pending = { data: FinanceBackup; baseline: string; existingReports: number; existingEntries: number; existingVouchers: number; existingOpening: number };
const readJson = <T,>(value: string | undefined, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
const download = (data: FinanceBackup, prefix: string) => {
  const blob = new Blob([buildFinanceBackup(data)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}_${data.from}_${data.to}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export default function FinanceBackupPanel({ school, reports, user, viewAsUid, demo }: { school: string; reports: DailyReport[]; user?: User; viewAsUid?: string; demo: boolean }) {
  const dates = useMemo(() => reports.map(report => report.date).sort(), [reports]);
  const [from, setFrom] = useState(dates[0] || todayIso());
  const [to, setTo] = useState(dates.at(-1) || todayIso());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [backupReady, setBackupReady] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const cashbookKey = `school-cashbook:${school}`;
  const vouchersKey = `school-vouchers:${school}`;
  const openingKey = `${cashbookKey}:opening`;

  const getCurrent = async (): Promise<Current> => {
    const [latestReports, appState] = demo
      ? [loadDemoReports(), { [cashbookKey]: scopedStorage.getItem(cashbookKey) || "[]", [vouchersKey]: scopedStorage.getItem(vouchersKey) || "{}", [openingKey]: scopedStorage.getItem(openingKey) || "{}" }] as const
      : await Promise.all([loadBudgetReports(user!, viewAsUid), loadAppState(user!, viewAsUid)]);
    return {
      reports: latestReports,
      entries: readJson<CashbookEntry[]>(appState[cashbookKey], []),
      vouchers: readJson<Record<string, Voucher>>(appState[vouchersKey], {}),
      opening: readJson<Record<string, number>>(appState[openingKey], {}),
      appState,
    };
  };
  const pick = (current: Current, start: string, end: string): FinanceBackup => {
    const reports = current.reports.filter(report => inRange(report.date, start, end));
    const entries = current.entries.filter(entry => inRange(entry.date, start, end)).map(({ attachment: _attachment, ...entry }) => { void _attachment; return entry; });
    const ids = new Set(entries.map(entry => entry.id));
    const vouchers = Object.fromEntries(Object.entries(current.vouchers).filter(([id]) => ids.has(id)).map(([id, voucher]) => [id, { number: voucher.number, party: voucher.party, purpose: voucher.purpose, note: voucher.note }]));
    const years = new Set<number>();
    for (let year = fiscalYearOf(start); year <= fiscalYearOf(end); year++) years.add(year);
    const opening = Object.fromEntries(Object.entries(current.opening).filter(([key]) => years.has(Number(key.split(":", 1)[0]))));
    return { school, from: start, to: end, createdAt: new Date().toISOString(), reports, entries, vouchers, opening };
  };
  const baselineOf = (current: Current, data: FinanceBackup) => JSON.stringify({
    reports: current.reports.filter(report => data.reports.some(item => item.date === report.date)),
    cashbook: current.appState[cashbookKey] || "",
    vouchers: current.appState[vouchersKey] || "",
    opening: current.appState[openingKey] || "",
  });
  const exportRange = async () => {
    if (from > to) { setMessage("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"); return; }
    setBusy(true); setMessage("");
    try {
      const data = pick(await getCurrent(), from, to);
      if (!data.reports.length && !data.entries.length) { setMessage("ช่วงวันที่นี้ยังไม่มีข้อมูลให้ส่งออก"); return; }
      download(data, "ThaiTeacher_สำรองการเงิน");
      setMessage(`ส่งออก ${data.reports.length} วัน และ ${data.entries.length} รายการรับ–จ่ายแล้ว`);
    } catch { setMessage("อ่านข้อมูลล่าสุดหรือสร้างไฟล์ Excel ไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setBusy(false); }
  };
  const selectFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage(""); setPending(null); setBackupReady(false);
    try {
      const data = await parseFinanceBackup(file);
      if (data.school !== school) throw new Error(`ไฟล์นี้เป็นของ ${data.school} ไม่ตรงกับ ${school}`);
      const current = await getCurrent();
      const reportDates = new Set(current.reports.map(report => report.date));
      const entryIds = new Set(current.entries.map(entry => entry.id));
      setPending({ data, baseline: baselineOf(current, data),
        existingReports: data.reports.filter(report => reportDates.has(report.date)).length,
        existingEntries: data.entries.filter(entry => entryIds.has(entry.id)).length,
        existingVouchers: Object.keys(data.vouchers).filter(id => Boolean(current.vouchers[id])).length,
        existingOpening: Object.keys(data.opening).filter(key => current.opening[key] !== undefined).length,
      });
      setReplaceExisting(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const downloadBeforeRestore = async () => {
    if (!pending) return;
    setBusy(true); setMessage("");
    try {
      const current = await getCurrent();
      if (baselineOf(current, pending.data) !== pending.baseline) { setMessage("ข้อมูลในระบบเปลี่ยนไป กรุณาเลือกไฟล์ใหม่เพื่อตรวจสอบอีกครั้ง"); setPending(null); return; }
      download(pick(current, pending.data.from, pending.data.to), "ThaiTeacher_ก่อนกู้คืน");
      setBackupReady(true);
    } catch { setMessage("สร้างสำเนาข้อมูลปัจจุบันไม่สำเร็จ ยังไม่ได้กู้คืนข้อมูล"); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!pending || !backupReady) return;
    setBusy(true); setMessage("");
    try {
      const { data } = pending;
      const current = await getCurrent();
      if (baselineOf(current, data) !== pending.baseline) { setMessage("ข้อมูลในระบบเปลี่ยนไปหลังเปิดตัวอย่าง กรุณาเลือกไฟล์ใหม่เพื่อตรวจสอบอีกครั้ง"); setPending(null); return; }
      const existingDates = new Set(current.reports.map(report => report.date));
      const saveReports = data.reports.filter(report => replaceExisting || !existingDates.has(report.date));
      const entryMap = new Map(current.entries.map(entry => [entry.id, entry]));
      for (const entry of data.entries) if (replaceExisting || !entryMap.has(entry.id)) entryMap.set(entry.id, { ...entry, attachment: entryMap.get(entry.id)?.attachment });
      const vouchers = { ...current.vouchers };
      for (const [id, voucher] of Object.entries(data.vouchers)) if (replaceExisting || !vouchers[id]) vouchers[id] = { ...voucher, attachments: vouchers[id]?.attachments || [] };
      const opening = { ...current.opening };
      for (const [key, value] of Object.entries(data.opening)) if (replaceExisting || opening[key] === undefined) opening[key] = value;
      if (saveReports.length) {
        if (demo) saveDemoReports(saveReports);
        else await saveBudgetReports(user!, saveReports, viewAsUid);
      }
      const updates: [string, string][] = [
        [cashbookKey, JSON.stringify([...entryMap.values()])],
        [vouchersKey, JSON.stringify(vouchers)],
        [openingKey, JSON.stringify(opening)],
      ];
      for (const [key, value] of updates) if (value !== (current.appState[key] || (key === cashbookKey ? "[]" : "{}"))) {
        if (demo) scopedStorage.setItem(key, value);
        else await writeAppState(user!, key, value, viewAsUid);
      }
      if (!demo && saveReports.length) {
        try {
          const cached = readJson<{ name: string; reports: DailyReport[] }[]>(scopedStorage.getItem("school-finances-v2") || "[]", []);
          const merged = new Map(current.reports.map(report => [report.date, report]));
          for (const report of saveReports) merged.set(report.date, report);
          const updated = { name: school, reports: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)) };
          const index = cached.findIndex(item => item.name === school);
          scopedStorage.setItem("school-finances-v2", JSON.stringify(index < 0 ? [...cached, updated] : cached.map((item, i) => i === index ? updated : item)));
        } catch { /* Server data is saved even if browser cache is full. */ }
      }
      setMessage("กู้คืนสำเร็จ กำลังโหลดข้อมูลล่าสุด…");
      setPending(null);
      window.location.reload();
    } catch { setMessage("กู้คืนไม่ครบหรือข้อมูลถูกแก้จากอีกเครื่อง กรุณาเก็บไฟล์สำรองก่อนกู้คืนไว้ แล้วโหลดข้อมูลล่าสุดเพื่อตรวจสอบก่อนลองใหม่"); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-slate-900 sm:p-6">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FileSpreadsheet size={22}/></span><div><h2 className="text-xl font-semibold">สำรองและกู้คืนข้อมูลการเงิน</h2><p className="mt-1 text-sm text-slate-500">เลือกวันที่ได้ทุกปี · ไฟล์ Excel รวมยอดรายวัน รายรับ–รายจ่าย ใบสำคัญ และยอดยกมา</p></div></div>
    <div className="mt-5 flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-sm font-medium">ตั้งแต่วันที่<ThaiDatePicker value={from} onChange={setFrom}/></label><label className="grid gap-1.5 text-sm font-medium">ถึงวันที่<ThaiDatePicker value={to} onChange={setTo}/></label><button type="button" disabled={busy} onClick={() => void exportRange()} className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 font-semibold text-white disabled:opacity-50"><Download size={18}/> ส่งออก Excel</button></div>
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:text-blue-300"><Upload size={17}/> เลือกไฟล์ Excel เพื่อกู้คืน<input type="file" accept=".xlsx" className="sr-only" disabled={busy} onChange={event => { void selectFile(event.target.files?.[0]); event.target.value = ""; }}/></label><span className="text-xs text-slate-500">ข้อมูลที่มีอยู่จะไม่ถูกทับ เว้นแต่เลือกแทนที่หลังตรวจตัวอย่าง</span></div>
    {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">{message}</p>}
    {pending && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
      <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle size={18}/> ตรวจข้อมูลก่อนกู้คืน</div>
      <p className="mt-2 text-sm">{thaiDate(pending.data.from)} – {thaiDate(pending.data.to)} · ยอดรายวัน {pending.data.reports.length} วัน ({pending.existingReports} วันมีแล้ว) · รับ–จ่าย {pending.data.entries.length} รายการ ({pending.existingEntries} รายการมีแล้ว) · ใบสำคัญ {Object.keys(pending.data.vouchers).length} รายการ ({pending.existingVouchers} รายการมีแล้ว) · ยอดยกมา {Object.keys(pending.data.opening).length} รายการ ({pending.existingOpening} รายการมีแล้ว)</p>
      <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceExisting} onChange={event => setReplaceExisting(event.target.checked)} className="mt-1"/><span>แทนที่รายการที่มีรหัสหรือวันที่ตรงกัน (เก็บไฟล์แนบเดิมของรายการนั้น)</span></label>
      <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">ดาวน์โหลดข้อมูลปัจจุบันก่อนกู้คืน · ไฟล์แนบไม่ได้อยู่ใน Excel และต้องสำรองแยก</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void downloadBeforeRestore()} className="inline-flex items-center gap-2 rounded-lg border border-amber-500 px-4 py-2 font-semibold"><Download size={17}/> {backupReady ? "ดาวน์โหลดสำเนาอีกครั้ง" : "1. ดาวน์โหลดสำเนาปัจจุบัน"}</button><button type="button" disabled={busy || !backupReady} onClick={() => void restore()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"><RotateCcw size={17}/> 2. ยืนยันกู้คืน</button><button type="button" onClick={() => setPending(null)} className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700">ยกเลิก</button></div>
    </div>}
  </section>;
}
