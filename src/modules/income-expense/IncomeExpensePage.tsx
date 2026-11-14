import { scopedStorage } from '../../shared/funtion/scopedStorage';
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import axios from "axios";
import { deleteCashbookEntry, loadCashbookEntries, saveCashbookEntry } from "../../config/services/cashbook.service";
import { loadDemoReports, saveDemoReports } from "../../features/auth/demoFinanceStore";
import { loadLoanContracts } from "../../config/services/loan-contracts.service";
import { loanLedgerEntries } from "../loan-contracts/loanLedger";
import type { LoanContract } from "../loan-contracts/loanContract";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Landmark,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { thaiDate } from "../../shared/funtion/thaiDate";
import { currentFiscalYear, firstDayOfFiscalYear, fiscalYearOf } from "../../shared/funtion/fiscalYear";

import type { CashbookEntry as Entry, DailyReport } from '../../shared/funtion/types';
import { money } from '../../shared/funtion/money';
import AnimatedNumber from "../../shared/components/AnimatedNumber";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
type Draft = Omit<Entry, "id" | "amount" | "attachment"> & {
  amount: string;
  attachment?: Entry["attachment"];
};
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const defaultFilterDate = (fiscalYear: number, reports: DailyReport[]) =>
  fiscalYear === currentFiscalYear()
    ? today()
    : [...reports].filter((report) => fiscalYearOf(report.date) === fiscalYear).sort((a, b) => b.date.localeCompare(a.date))[0]?.date || firstDayOfFiscalYear(fiscalYear);
const key = (school: string) => `school-cashbook:${school}`;
const linkedKey = (school: string) => `${key(school)}:linked-ids`;
const empty = (category: string): Draft => ({
  date: today(),
  kind: "income",
  category,
  account: "cash",
  documentNo: "",
  description: "",
  amount: "",
  party: "",
  note: "",
});
const accountNames = {
  cash: "เงินสด",
  bank: "เงินฝากธนาคาร",
  government: "เงินฝากส่วนราชการผู้เบิก",
};
export default function IncomeExpensePage({
  school,
  categories,
  fiscalYear,
  reports,
  initialCategory,
  user,
  viewAsUid,
  demo = false,
  tourActive = false,
}: {
  school: string;
  categories: string[];
  fiscalYear: number;
  reports: DailyReport[];
  initialCategory?: string;
  user?: User;
  viewAsUid?: string;
  demo?: boolean;
  tourActive?: boolean;
}) {
  const options = [
    ...new Set([
      ...(categories.length ? categories : ["เงินรายได้สถานศึกษา"]),
      ...(initialCategory ? [initialCategory] : []),
    ]),
  ];
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = JSON.parse(scopedStorage.getItem(key(school)) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [remoteVersions, setRemoteVersions] = useState<Record<string, string>>({});
  const [savingEntry, setSavingEntry] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(!demo && Boolean(user));
  const [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    if (demo || !user) return;
    let active = true;
    const refresh = async () => {
      try {
        const remote = await loadCashbookEntries(user, viewAsUid);
        if (!active) return;
        const local: Entry[] = JSON.parse(scopedStorage.getItem(key(school)) || "[]");
        const previouslyLinked: string[] = JSON.parse(scopedStorage.getItem(linkedKey(school)) || "[]");
        const remoteIds = new Set(remote.map((item) => item.id));
        const legacy = local.filter((item) => !remoteIds.has(item.id) && !previouslyLinked.includes(item.id));
        const localById = new Map(local.map((item) => [item.id, item]));
        const merged = [...legacy, ...remote.map((item) => ({ ...item, attachment: localById.get(item.id)?.attachment }))];
        setEntries(merged);
        setRemoteVersions(Object.fromEntries(remote.map((item) => [item.id, item.version])));
        const encoded = JSON.stringify(merged);
        if (scopedStorage.getItem(key(school)) !== encoded) scopedStorage.setItem(key(school), encoded);
        const linked = JSON.stringify([...new Set([...previouslyLinked, ...remoteIds])]);
        if (scopedStorage.getItem(linkedKey(school)) !== linked) scopedStorage.setItem(linkedKey(school), linked);
      } catch { if (active) setSyncMessage("โหลดรายการรับ–จ่ายจากระบบไม่สำเร็จ กรุณาโหลดหน้าใหม่ก่อนบันทึก"); }
      finally { if (active) setLoadingEntries(false); }
    };
    void refresh();
    window.addEventListener("project-expenses-changed", refresh);
    return () => { active = false; window.removeEventListener("project-expenses-changed", refresh); };
  }, [demo, user, viewAsUid, school]);
  const [loanEntries, setLoanEntries] = useState<Entry[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const contracts: LoanContract[] = demo
          ? JSON.parse(scopedStorage.getItem(`school-loan-contracts:${school}`) || "[]")
          : user ? await loadLoanContracts(user, viewAsUid) : [];
        if (active) setLoanEntries(loanLedgerEntries(contracts));
      } catch { if (active) setLoanEntries([]); }
    };
    void refresh();
    window.addEventListener("loan-contracts-changed", refresh);
    return () => { active = false; window.removeEventListener("loan-contracts-changed", refresh); };
  }, [school, user, viewAsUid, demo]);
  const [selectedCategory, setCategory] = useState(
    initialCategory && options.includes(initialCategory)
      ? initialCategory
      : options[0],
  );
  const category = options.includes(selectedCategory) ? selectedCategory : options[0];
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [dateSelection, setDateSelection] = useState(() => ({ year: fiscalYear, date: defaultFilterDate(fiscalYear, reports) }));
  const dateFilter = dateSelection.year === fiscalYear ? dateSelection.date : defaultFilterDate(fiscalYear, reports);
  const setDateFilter = (date: string) => setDateSelection({ year: fiscalYear, date });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => empty(options[0]));
  const [error, setError] = useState("");
  const periodStart = dateFilter || firstDayOfFiscalYear(fiscalYear);
  const openingReport = [...reports]
    .filter((report) => report.date < periodStart)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const openingRow = openingReport?.rows.find((row) => !row.group && row.name === category);
  const opening = openingRow ? openingRow.cash + openingRow.bank + openingRow.government : null;
  const tourEntries: Entry[] = useMemo(() => (tourActive || demo) && entries.length === 0 && loanEntries.length === 0 ? [
    { id: "tour-income", date: today(), kind: "income", category, account: "bank", documentNo: "ร.001/2570", description: "รับเงินอุดหนุน", amount: 2000, party: "หน่วยงานต้นสังกัด", note: "" },
    { id: "tour-expense", date: today(), kind: "expense", category, account: "bank", documentNo: "จ.001/2570", description: "ซื้ออุปกรณ์การเรียน", amount: 1200, party: "ร้านค้าตัวอย่าง", note: "" },
  ] : [], [tourActive, demo, entries.length, loanEntries.length, category]);
  const categoryEntries = useMemo(
    () =>
      [...entries, ...loanEntries, ...tourEntries]
        .filter((entry) => entry.category === category && fiscalYearOf(entry.date)===fiscalYear)
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        ),
    [entries, loanEntries, tourEntries, category, fiscalYear],
  );
  const legacyCount = !demo && !loadingEntries ? entries.filter((entry) => !remoteVersions[entry.id]).length : 0;
  const periodEntries = dateFilter ? categoryEntries.filter((entry) => entry.date === dateFilter) : categoryEntries;
  const totals = periodEntries.reduce(
    (sum, entry) => ({ ...sum, [entry.kind]: sum[entry.kind] + entry.amount }),
    { income: 0, expense: 0 },
  );
  const balanceReport = [...reports]
    .filter((report) => fiscalYearOf(report.date) === fiscalYear && (!dateFilter || report.date <= dateFilter))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const balanceRow = balanceReport?.rows.find((row) => !row.group && row.name === category);
  const reportedBalance = balanceRow ? balanceRow.cash + balanceRow.bank + balanceRow.government : null;
  const balances = new Map<string, number>();
  const netThroughReport = balanceReport
    ? categoryEntries.filter((entry) => entry.date <= balanceReport.date).reduce((sum, entry) => sum + (entry.kind === "income" ? entry.amount : -entry.amount), 0)
    : 0;
  const registerDifference = opening === null || reportedBalance === null || (dateFilter && balanceReport?.date !== dateFilter)
    ? 0
    : reportedBalance - (opening + (dateFilter ? totals.income - totals.expense : netThroughReport));
  let running = reportedBalance === null ? (opening ?? 0) : reportedBalance - netThroughReport;
  categoryEntries.forEach((entry) => {
    running += entry.kind === "income" ? entry.amount : -entry.amount;
    balances.set(entry.id, running);
  });
  const visible = categoryEntries
    .filter(
      (entry) =>
        (kindFilter === "all" || entry.kind === kindFilter) &&
        (!dateFilter || entry.date === dateFilter) &&
        (!query ||
          `${entry.description} ${entry.documentNo} ${entry.party}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .reverse();
  const clearFilters = () => {
    setKindFilter("all");
    setDateFilter("");
    setQuery("");
  };
  const emptyMessage =
    categoryEntries.length === 0
      ? `ยังไม่มีรายการในประเภทเงินนี้สำหรับปีงบประมาณ ${fiscalYear}`
      : "ไม่พบรายการตามตัวกรองที่เลือก";
  const saveEntries = (next: Entry[]) => {
    setEntries(next);
    try { scopedStorage.setItem(key(school), JSON.stringify(next)); }
    catch {
      if (demo) throw new Error("demo_storage_full");
      setSyncMessage("บันทึกในระบบแล้ว แต่บันทึกสำเนาในเครื่องไม่สำเร็จ กรุณาโหลดหน้าใหม่ก่อนทำรายการต่อ");
    }
  };
  const start = (kind: "income" | "expense", entry?: Entry) => {
    setDraft(
      entry
        ? { ...entry, amount: String(entry.amount) }
        : { ...empty(category), date:fiscalYear===currentFiscalYear()?today():firstDayOfFiscalYear(fiscalYear), kind },
    );
    setEditing(entry?.id || null);
    setError("");
    setOpen(true);
  };
  useEffect(() => {
    const showStep = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; title: string }>).detail;
      if (detail?.path !== "/finance/income-expense") return;
      setOpen(false);
      if (detail.title === "ตัวอย่างรายการ" && options.includes("เงินอุดหนุนค่าใช้จ่ายรายหัว")) setCategory("เงินอุดหนุนค่าใช้จ่ายรายหัว");
      if (detail.title === "บันทึกรายรับ" || detail.title === "บันทึกรายจ่าย") {
        const kind = detail.title === "บันทึกรายรับ" ? "income" : "expense";
        start(kind);
        setDraft((current) => ({ ...current, category: "เงินอุดหนุนค่าใช้จ่ายรายหัว", account: "bank", amount: kind === "income" ? "2000" : "1200", description: kind === "income" ? "รับเงินอุดหนุน" : "ซื้ออุปกรณ์การเรียน", documentNo: kind === "income" ? "ร.001/2570" : "จ.001/2570" }));
      }
    };
    window.addEventListener("thaiteacher:tour-step", showStep);
    return () => window.removeEventListener("thaiteacher:tour-step", showStep);
  });
  useEffect(() => {
    if (tourActive) return;
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [tourActive]);
  const save = async () => {
    const amount = Number(draft.amount);
    if(draft.date && fiscalYearOf(draft.date)!==fiscalYear){setError(`วันที่ต้องอยู่ในปีงบประมาณ ${fiscalYear}`);return}
    if (
      !draft.date ||
      !draft.category ||
      !draft.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("กรอกวันที่ ประเภทเงิน รายการ และจำนวนเงินที่มากกว่า 0");
      return;
    }
    const item: Entry = {
      ...draft,
      id: editing || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount,
      description: draft.description.trim(),
    };
    if (!demo && !user) { setError("กรุณาเข้าสู่ระบบก่อนบันทึก"); return; }
    if (loadingEntries) { setError("กำลังโหลดรายการล่าสุด กรุณารอสักครู่"); return; }
    if (!demo && syncMessage) { setError(syncMessage); return; }
    if (editing && !demo && !remoteVersions[editing] && !window.confirm("รายการนี้บันทึกก่อนเชื่อมรายงาน การแก้ไขจะนำยอดใหม่เข้ารายงานรายวัน โปรดตรวจว่ารายงานเดิมยังไม่รวมยอดนี้")) return;
    setSavingEntry(true);
    try {
      if (demo) {
        const reports = loadDemoReports();
        const changes = [editing ? entries.find((entry) => entry.id === editing) : undefined, item] as const;
        const updated = new Map<string, typeof reports[number]>();
        for (const [index, change] of changes.entries()) {
          if (!change) continue;
          const report = updated.get(change.date) || reports.find((row) => row.date === change.date) || [...reports].filter((row) => row.date < change.date).sort((a, b) => b.date.localeCompare(a.date))[0];
          if (!report) throw new Error("missing_report");
          const base = report.date === change.date ? report : { date: change.date, rows: report.rows.map((row) => ({ ...row, note: "" })) };
          const sign = (change.kind === "income" ? 1 : -1) * (index === 0 ? -1 : 1);
          let found = false;
          const rows = base.rows.map((row) => {
            if (row.group || row.name !== change.category) return row;
            found = true;
            const next = row[change.account] + sign * change.amount;
            if (next < 0) throw new Error("insufficient_balance");
            return { ...row, [change.account]: next };
          });
          if (!found) throw new Error("missing_category");
          updated.set(change.date, { ...base, rows });
        }
        saveDemoReports([...updated.values()]);
      } else if (user) {
        const stored = await saveCashbookEntry(user, item, editing ? remoteVersions[editing] : undefined, viewAsUid);
        setRemoteVersions((current) => ({ ...current, [item.id]: stored.version }));
        try {
          const linked: string[] = JSON.parse(scopedStorage.getItem(linkedKey(school)) || "[]");
          if (!linked.includes(item.id)) scopedStorage.setItem(linkedKey(school), JSON.stringify([...linked, item.id]));
        } catch { setSyncMessage("บันทึกในระบบแล้ว แต่บันทึกสำเนาในเครื่องไม่สำเร็จ กรุณาโหลดหน้าใหม่ก่อนทำรายการต่อ"); }
      }
      saveEntries(
        editing
          ? entries.map((entry) => (entry.id === editing ? item : entry))
          : [...entries, item],
      );
      setOpen(false);
      window.dispatchEvent(new Event("finance-report-changed"));
    } catch (cause) {
      setError(axios.isAxiosError(cause) && cause.response?.status === 409 ? "รายการถูกแก้จากอีกเครื่อง กรุณาโหลดหน้าใหม่" : axios.isAxiosError(cause) && cause.response?.status === 422 ? "ปรับยอดรายงานไม่ได้ กรุณาตรวจประเภทเงิน ช่องทาง และยอดคงเหลือของวันนั้น" : "บันทึกไม่สำเร็จ กรุณาตรวจว่ามีรายงานวันก่อนหน้าและลองอีกครั้ง");
    } finally { setSavingEntry(false); }
  };
  const remove = async (entry: Entry) => {
    if (loadingEntries || (!demo && syncMessage)) { setSyncMessage("กรุณาโหลดรายการล่าสุดให้สำเร็จก่อนลบ"); return; }
    if (!window.confirm(remoteVersions[entry.id] || demo ? "ลบรายการนี้? ยอดในรายงานของวันที่ทำรายการจะปรับกลับด้วย" : "ลบรายการเก่านี้? รายการนี้ยังไม่เชื่อมกับยอดในรายงานรายวัน")) return;
    setSavingEntry(true);
    try {
      if (!demo && user && remoteVersions[entry.id]) {
        await deleteCashbookEntry(user, entry.id, remoteVersions[entry.id], viewAsUid);
        setRemoteVersions((current) => { const next = { ...current }; delete next[entry.id]; return next; });
      } else if (demo) {
        const reports = loadDemoReports();
        const report = reports.find((row) => row.date === entry.date);
        if (!report) throw new Error("missing_report");
        let found = false;
        const rows = report.rows.map((row) => {
          if (row.group || row.name !== entry.category) return row;
          found = true;
          const next = row[entry.account] + (entry.kind === "income" ? -entry.amount : entry.amount);
          if (next < 0) throw new Error("insufficient_balance");
          return { ...row, [entry.account]: next };
        });
        if (!found) throw new Error("missing_category");
        saveDemoReports([{ ...report, rows }]);
      }
      saveEntries(entries.filter((item) => item.id !== entry.id));
      window.dispatchEvent(new Event("finance-report-changed"));
    } catch (cause) {
      setSyncMessage(axios.isAxiosError(cause) && cause.response?.status === 409 ? "รายการถูกแก้จากอีกเครื่อง กรุณาโหลดหน้าใหม่" : "ลบรายการไม่สำเร็จ กรุณาตรวจยอดในรายงานของวันนั้น");
    } finally { setSavingEntry(false); }
  };
  const onFile = (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setError("ไฟล์แนบต้องมีขนาดไม่เกิน 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((current) => ({
        ...current,
        attachment: { name: file.name, data: String(reader.result) },
      }));
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-5">
      {syncMessage && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{syncMessage}</p>}
      {legacyCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">มีรายการเก่า {legacyCount} รายการที่บันทึกก่อนเชื่อมรายงาน ระบบไม่ปรับยอดย้อนหลังอัตโนมัติเพื่อป้องกันการนับซ้ำ</p>}
      {Math.abs(registerDifference) >= 0.01 && <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">ยอดยกมาและรายการในทะเบียนยังไม่ตรงกับรายงาน ต่างกัน ฿ {money(Math.abs(registerDifference))} · โปรดตรวจรายการที่ยังไม่ได้บันทึกในทะเบียน</p>}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center sm:p-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            ประเภทเงิน
          </p>
          <p className="mt-1 text-xs text-slate-500">
            เลือกประเภทเงินที่ต้องการดูหรือบันทึกรายการ
          </p>
        </div>
        <select
          data-tour="cashbook-category"
          aria-label="ประเภทเงิน"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-900 outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100 lg:ml-auto lg:max-w-sm"
        >
          {options.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <div data-tour="cashbook-actions" className="flex w-full gap-2 lg:w-auto lg:shrink-0"><button onClick={() => start("income")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 lg:flex-none"><ArrowDownLeft size={18}/> บันทึกรายรับ</button><button onClick={() => start("expense")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 lg:flex-none"><ArrowUpRight size={18}/> บันทึกรายจ่าย</button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "ยอดยกมา",
            value: opening,
            Icon: Wallet,
            accent:
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            number: "text-slate-900 dark:text-white",
            line: "bg-slate-300",
          },
          {
            label: "รับรวม",
            value: totals.income,
            Icon: ArrowDownLeft,
            accent:
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
            number: "text-emerald-700 dark:text-emerald-300",
            line: "bg-emerald-400",
          },
          {
            label: "จ่ายรวม",
            value: totals.expense,
            Icon: ArrowUpRight,
            accent:
              "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
            number: "text-rose-700 dark:text-rose-300",
            line: "bg-rose-400",
          },
          {
            label: "คงเหลือ",
            value: dateFilter && balanceReport?.date !== dateFilter
              ? opening === null ? null : opening + totals.income - totals.expense
              : reportedBalance ?? (opening === null ? null : opening + totals.income - totals.expense),
            Icon: Landmark,
            accent:
              "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
            number: "text-blue-700 dark:text-blue-300",
            line: "bg-blue-500",
          },
        ].map(({ label, value, Icon, accent, number, line }) => (
          <article
            key={label}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${line}`} />
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <span
                className={`grid size-10 place-items-center rounded-xl ${accent}`}
              >
                <Icon size={20} />
              </span>
            </div>
            <p
              className={`mt-4 break-all text-2xl font-bold tracking-tight tabular-nums ${number}`}
            >
              {value === null ? "—" : <>฿ <AnimatedNumber value={value} format={money} /></>}
            </p>
            {label === "ยอดยกมา" ? (
              <p className="mt-3 text-xs text-slate-500">{openingReport ? `จากรายงานวันที่ ${thaiDate(openingReport.date)} · รวม 3 ช่องทาง` : "ยังไม่มีรายงานก่อนช่วงวันที่เลือก"}</p>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                {label === "คงเหลือ"
                  ? dateFilter && balanceReport?.date !== dateFilter ? "คำนวณจากยอดยกมาและรายการของวัน" : balanceReport ? `ยอดตามรายงานวันที่ ${thaiDate(balanceReport.date)}` : "ยังไม่มีรายงานสำหรับประเภทเงินนี้"
                  : `${categoryEntries.length} รายการในทะเบียน`}
              </p>
            )}
          </article>
        ))}
      </div>
      <section data-tour="cashbook-list" className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5 xl:grid-cols-[minmax(0,1fr)_auto_auto_16rem] xl:items-center">
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <h3 className="font-semibold">รายการในทะเบียน</h3>
            <p className="text-xs text-slate-500">
              {categoryEntries.length} รายการ · {category}{dateFilter ? ` · ${thaiDate(dateFilter)}` : " · ทุกวันในปีงบประมาณ"}
            </p>
          </div>
          <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                ["all", "ทั้งหมด"],
                ["income", "รับ"],
                ["expense", "จ่าย"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setKindFilter(value)}
                className={`rounded-md px-4 py-2 text-sm ${kindFilter === value ? "bg-white font-semibold text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:col-span-2 sm:justify-self-end sm:w-auto xl:col-span-1 xl:justify-self-auto">
            <button type="button" onClick={() => setDateFilter("")} aria-pressed={!dateFilter} className={`h-12 rounded-lg border px-3 text-sm font-semibold ${!dateFilter ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>ทุกวัน</button>
            <ThaiDatePicker value={dateFilter} onChange={setDateFilter} />
          </div>
          <label className="relative w-full sm:col-span-2 xl:col-span-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหารายการ / เลขที่"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>
        {visible.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500 xl:hidden">
            <p>{emptyMessage}</p>
            {categoryEntries.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 font-semibold text-blue-700 hover:underline dark:text-blue-300"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
        <div className="divide-y divide-slate-100 xl:hidden dark:divide-slate-800">
          {visible.map((entry) => (
            <article
              key={entry.id}
              className="p-4 transition hover:bg-blue-50/30 dark:hover:bg-slate-800/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">
                    {thaiDate(entry.date)} ·{" "}
                    {entry.documentNo || "ไม่มีเลขที่เอกสาร"}
                  </p>
                  <h3 className="mt-1 font-semibold">{entry.description}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {accountNames[entry.account]}
                    {entry.party ? ` · ${entry.party}` : ""}
                  </p>
                </div>
                <strong
                  className={`whitespace-nowrap text-base tabular-nums ${entry.kind === "income" ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {entry.kind === "income" ? "+" : "−"}
                  {money(entry.amount)}
                </strong>
              </div>
              {entry.note && (
                <p className="mt-2 text-sm text-slate-500">{entry.note}</p>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                <span>
                  คงเหลือ <b>฿ {money(balances.get(entry.id) || 0)}</b>
                </span>
                <div className="flex items-center gap-2">
                  {entry.attachment && (
                    <a
                      href={entry.attachment.data}
                      download={entry.attachment.name}
                      aria-label="ดูหลักฐาน"
                      className="text-blue-700"
                    >
                      <FileText size={18} />
                    </a>
                  )}
                  {!entry.id.startsWith("loan:") && !entry.id.startsWith("pexp_") && <button
                    onClick={() => start(entry.kind, entry)}
                    aria-label="แก้ไขรายการ"
                    className="p-1 text-blue-700"
                  >
                    <Pencil size={18} />
                  </button>}
                  {!entry.id.startsWith("loan:") && !entry.id.startsWith("pexp_") && <button
                    onClick={() => void remove(entry)}
                    disabled={savingEntry}
                    aria-label="ลบรายการ"
                    className="p-1 text-rose-600"
                  >
                    <Trash2 size={18} />
                  </button>}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden xl:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[23%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-blue-50/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {[
                  "วันที่",
                  "เลขที่เอกสาร",
                  "รายการ / ผู้เกี่ยวข้อง",
                  "ช่องทาง",
                  "รับ",
                  "จ่าย",
                  "คงเหลือ",
                  "หลักฐาน",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-2 py-3 font-semibold ${["รับ", "จ่าย", "คงเหลือ"].includes(h) ? "text-right" : h === "หลักฐาน" || !h ? "text-center" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((entry) => (
                <tr
                  key={entry.id}
                  className="transition hover:bg-blue-50/40 dark:hover:bg-slate-800/60"
                >
                  <td className="whitespace-nowrap px-2 py-3">
                    {thaiDate(entry.date)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">{entry.documentNo || "–"}</td>
                  <td className="max-w-[22rem] px-2 py-3">
                    <span className="font-medium">{entry.description}</span>
                    {entry.party && (
                      <span className="block text-xs text-slate-500">
                        {entry.party}
                      </span>
                    )}
                    {entry.note && (
                      <span className="block text-xs text-slate-500">
                        {entry.note}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">{accountNames[entry.account]}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-emerald-700">
                    {entry.kind === "income" ? money(entry.amount) : "–"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold text-rose-700">
                    {entry.kind === "expense" ? money(entry.amount) : "–"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">
                    {money(balances.get(entry.id) || 0)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-center">
                    {entry.attachment ? (
                      <a
                        href={entry.attachment.data}
                        download={entry.attachment.name}
                        className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300"
                      >
                        <FileText size={15} /> ดูไฟล์
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3 text-center">
                    {!entry.id.startsWith("loan:") && !entry.id.startsWith("pexp_") && <button
                      onClick={() => start(entry.kind, entry)}
                      aria-label="แก้ไขรายการ"
                      className="rounded p-2 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
                    >
                      <Pencil size={16} />
                    </button>}
                    {!entry.id.startsWith("loan:") && !entry.id.startsWith("pexp_") && <button
                      onClick={() => void remove(entry)}
                      disabled={savingEntry}
                      aria-label="ลบรายการ"
                      className="rounded p-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={16} />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-500">
              <p>{emptyMessage}</p>
              {categoryEntries.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            data-tour="tour-active-modal"
            role="dialog"
            aria-modal="true"
            className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                  ทะเบียนรายรับ–รายจ่าย
                </p>
                <h3 className="text-xl font-semibold">
                  {editing ? "แก้ไข" : "บันทึก"}ราย
                  {draft.kind === "income" ? "รับ" : "จ่าย"}
                </h3>
                <p className="text-sm text-slate-500">
                  ข้อมูลจะอยู่ในทะเบียนของ {school}
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="ปิด">
                <X size={22} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                ประเภท
                <select
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      kind: e.target.value as Draft["kind"],
                    }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                >
                  <option value="income">รายรับ</option>
                  <option value="expense">รายจ่าย</option>
                </select>
              </label>
              <div className="grid min-w-0 content-start gap-1 text-sm font-medium">
                <span>วันที่</span>
                <ThaiDatePicker value={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} />
              </div>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                ประเภทเงิน
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, category: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                >
                  {options.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                ช่องทาง
                <select
                  value={draft.account}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      account: e.target.value as Draft["account"],
                    }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                >
                  <option value="cash">เงินสด</option>
                  <option value="bank">เงินฝากธนาคาร</option>
                  <option value="government">เงินฝากส่วนราชการผู้เบิก</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                เลขที่เอกสาร
                <input
                  value={draft.documentNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, documentNo: e.target.value }))
                  }
                  placeholder="เลขที่ใบสำคัญ / ใบเสร็จ"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                จำนวนเงิน
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium sm:col-span-2">
                รายการ
                <input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="ระบุว่ารับหรือจ่ายเพื่ออะไร"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                รับจาก / จ่ายให้
                <input
                  value={draft.party}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, party: e.target.value }))
                  }
                  placeholder="ชื่อบุคคลหรือหน่วยงาน"
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                หลักฐานแนบ
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="w-full min-w-0 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-2 text-sm text-slate-900 dark:border-blue-800 dark:bg-slate-800 dark:text-white"
                />
                {draft.attachment && (
                  <span className="text-xs text-blue-700">
                    {draft.attachment.name}{" "}
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, attachment: undefined }))
                      }
                      className="text-rose-600"
                    >
                      ลบไฟล์
                    </button>
                  </span>
                )}
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium sm:col-span-2">
                หมายเหตุ
                <textarea
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, note: e.target.value }))
                  }
                  rows={2}
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus:bg-slate-800 dark:text-white"
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border px-4 py-2.5"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => void save()}
                disabled={savingEntry || loadingEntries || Boolean(syncMessage)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                <Plus size={17} /> {savingEntry ? "กำลังบันทึก..." : "บันทึกรายการ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

