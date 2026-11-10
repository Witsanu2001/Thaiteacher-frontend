import { scopedStorage } from "../../shared/funtion/scopedStorage";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Outlet, useLocation } from "react-router-dom";
import {
  loadBudgetReports,
  saveBudgetReports,
} from "../../config/services/budget-reports.service";
import {
  loadDemoReports,
  saveDemoReports,
} from "../../features/auth/demoFinanceStore";
import {
  mergeBudgetReports,
  sameReportRows,
} from "../../shared/funtion/reportSync";
import {
  X,
  GraduationCap,
  FileSpreadsheet,
  Wallet,
  Banknote,
  Landmark,
  Building2,
} from "lucide-react";
import { readDailyWorkbook } from "../../shared/funtion/readDailyWorkbook";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import { thaiDate } from "../../shared/funtion/thaiDate";
import DailyReportExport from "../exports/DailyReportExport";
import { FinancePageProvider } from "./FinancePageContext";
import Header from "../../shared/Header";
import AnimatedNumber from "../../shared/components/AnimatedNumber";
import {
  currentFiscalYear,
  firstDayOfFiscalYear,
  fiscalYearOf,
  todayIso as today,
} from "../../shared/funtion/fiscalYear";
import type {
  BalanceRow as Row,
  DailyReport as Report,
  FinanceSchool as School,
} from "../../shared/funtion/types";
import { money } from "../../shared/funtion/money";
import { pageFromPath } from "../../shared/menu";
const exampleRows: Row[] = [
  { name: "เงินงบประมาณ", level: 0, group: true },
  { name: "เงินรายได้แผ่นดิน", level: 0 },
  { name: "เงินนอกงบประมาณ", level: 0, group: true },
  { name: "เงินอุดหนุนค่าใช้จ่ายรายหัว", level: 1 },
  { name: "เงินอุดหนุนปัจจัยพื้นฐานนักเรียนยากจน", level: 1 },
  { name: "เงินอุดหนุนเรียนฟรี 15 ปี", level: 1, group: true },
  { name: "ค่าอุปกรณ์การเรียน", level: 2 },
  { name: "ค่าเครื่องแบบนักเรียน", level: 2 },
  { name: "ค่าหนังสือแบบเรียน", level: 2 },
  { name: "ค่ากิจกรรมพัฒนาผู้เรียน", level: 2 },
  { name: "เงินอุดหนุนโครงการอาหารกลางวัน", level: 1 },
  { name: "เงินรายได้สถานศึกษา", level: 1 },
  { name: "เงินอื่นๆ", level: 0, group: true },
].map((r) => ({ ...r, cash: 0, bank: 0, government: 0, note: "" }));
const input =
  "w-full rounded-lg border border-slate-300 bg-white p-3 text-base text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white";
const cacheSchools = (schools: School[]) => {
  try {
    scopedStorage.setItem("school-finances-v2", JSON.stringify(schools));
  } catch {
    /* Firestore remains the source of truth when browser storage is full. */
  }
};
export default function SchoolFinancePage({
  onMenu,
  dark,
  onToggleDark,
  onNavigate,
  initialSchoolName,
  user,
  viewAsUid,
  demo = false,
  onLogin,
}: {
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onNavigate: (page: string) => void;
  initialSchoolName: string;
  user?: User;
  viewAsUid?: string;
  demo?: boolean;
  onLogin?: () => void;
}) {
  const { pathname } = useLocation();
  const active = pageFromPath(pathname);
  const loadReports = useCallback(
    () => {
      if (demo) return Promise.resolve(loadDemoReports());
      if (!user) return Promise.reject(new Error("ต้องเข้าสู่ระบบก่อนอ่านรายงาน"));
      return loadBudgetReports(user, viewAsUid);
    },
    [demo, user, viewAsUid],
  );
  const saveReports = useCallback(
    (reports: Report[]) => {
      if (demo) return Promise.resolve(saveDemoReports(reports));
      if (!user) return Promise.reject(new Error("ต้องเข้าสู่ระบบก่อนบันทึกรายงาน"));
      return saveBudgetReports(user, reports, viewAsUid);
    },
    [demo, user, viewAsUid],
  );
  const [schools, setSchools] = useState<School[]>(() => {
    try {
      const saved = JSON.parse(
        scopedStorage.getItem("school-finances-v2") || "[]",
      ) as School[];
      return saved.length ? saved : [{ name: initialSchoolName, reports: [] }];
    } catch {
      return [{ name: initialSchoolName, reports: [] }];
    }
  });
  const [schoolIndex, setSchoolIndex] = useState(0),
    [selectedFiscalYear, setSelectedFiscalYear] = useState(() => {
      const saved = Number(
        scopedStorage.getItem(
          `school-selected-fiscal-year:${schools[0]?.name || ""}`,
        ),
      );
      return saved >= 2500 && saved <= 2900
        ? saved
        : schools[0]?.reports.at(-1)?.date
          ? fiscalYearOf(schools[0].reports.at(-1)!.date)
          : currentFiscalYear();
    }),
    [openedFiscalYears, setOpenedFiscalYears] = useState<number[]>(() => {
      try {
        return JSON.parse(
          scopedStorage.getItem(
            `school-fiscal-years:${schools[0]?.name || ""}`,
          ) || "[]",
        );
      } catch {
        return [];
      }
    }),
    [date, setDate] = useState(""),
    [open, setOpen] = useState(false);
  const [formMode, setFormMode] = useState<"template" | "balance">("template");
  const [name, setName] = useState(""),
    [reportDate, setReportDate] = useState(today()),
    [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<Awaited<
    ReturnType<typeof readDailyWorkbook>
  > | null>(null);
  const [importing, setImporting] = useState(false);
  const [reportLoading, setReportLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [conflictBackup, setConflictBackup] = useState<Report[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [carryOpen, setCarryOpen] = useState(false);
  const [carryError, setCarryError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cellEdit, setCellEdit] = useState<{
    index: number;
    field: "cash" | "bank" | "government" | "note";
  } | null>(null);
  const [operation, setOperation] = useState<
    "add" | "subtract" | "set" | "transfer"
  >("add");
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [cellError, setCellError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const remote = await loadReports();
        if (cancelled) return;
        const saved = JSON.parse(
          scopedStorage.getItem("school-finances-v2") || "[]",
        ) as School[];
        const current = saved.length
          ? saved
          : [{ name: initialSchoolName, reports: [] }];
        const index = Math.max(
          0,
          current.findIndex((item) => item.name === initialSchoolName),
        );
        const local = current[index].reports;
        const {
          reports: merged,
          localOnly,
          conflicts,
        } = mergeBudgetReports(local, remote);
        if (conflicts.length) {
          try {
            scopedStorage.setItem(
              `school-finances-conflict-backup:${initialSchoolName}:${Date.now()}`,
              JSON.stringify(conflicts),
            );
          } catch {
            /* The download button still exposes the in-memory backup. */
          }
        }
        setConflictBackup(conflicts);
        const next = current.map((item, i) =>
          i === index ? { ...item, reports: merged } : item,
        );
        cacheSchools(next);
        setSchools(next);
        setSchoolIndex(index);
        if (merged.length)
          setSelectedFiscalYear((year) =>
            merged.some((item) => fiscalYearOf(item.date) === year)
              ? year
              : fiscalYearOf(merged.at(-1)!.date),
          );
        if (localOnly.length) {
          try {
            await saveReports(localOnly);
          } catch {
            if (!cancelled)
              setSyncError(
                `มีรายงานในเครื่อง ${localOnly.length} วัน ที่ยังไม่อัปโหลด กรุณาลองโหลดหน้าใหม่เมื่อเชื่อมต่อได้`,
              );
          }
        }
        if (conflicts.length && !cancelled)
          setSyncError(
            `พบข้อมูลต่างกัน ${conflicts.length} วัน ใช้ข้อมูลจากระบบ และสำรองข้อมูลในเครื่องไว้แล้ว`,
          );
      } catch {
        if (!cancelled)
          setSyncError(
            "เรียกรายงานจากระบบไม่สำเร็จ ข้อมูลในเครื่องยังแสดงได้ กรุณาโหลดหน้าใหม่เมื่อการเชื่อมต่อกลับมา",
          );
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialSchoolName, loadReports, saveReports]);
  const school = schools[schoolIndex];
  useEffect(() => {
    if (school?.name)
      scopedStorage.setItem(
        `school-selected-fiscal-year:${school.name}`,
        String(selectedFiscalYear),
      );
  }, [school?.name, selectedFiscalYear]);
  const yearReports = (school?.reports || [])
    .filter((item) => fiscalYearOf(item.date) === selectedFiscalYear)
    .sort((a, b) => a.date.localeCompare(b.date));
  const fiscalYears = [
    ...new Set([
      selectedFiscalYear,
      ...openedFiscalYears,
      ...(school?.reports || []).map((item) => fiscalYearOf(item.date)),
    ]),
  ].sort((a, b) => b - a);
  const report = yearReports.find((r) => r.date === date) ?? yearReports.at(-1);
  const balanceOf = (r: Report) =>
    r.rows.reduce(
      (sum, row) =>
        sum + (row.group ? 0 : row.cash + row.bank + row.government),
      0,
    );
  const previousReport = yearReports
    .filter((r) => report && r.date < report.date)
    .at(-1);
  const previousRow = (row: Row, index: number) =>
    previousReport?.rows.find(
      (r) => r.name === row.name && (r.level ?? 0) === (row.level ?? 0),
    ) ?? previousReport?.rows[index];
  const movement = (
    row: Row,
    index: number,
    field: "cash" | "bank" | "government",
  ) =>
    previousReport && !row.group
      ? Math.round(
          (row[field] - (previousRow(row, index)?.[field] ?? 0)) * 100,
        ) / 100
      : 0;
  const movementCount =
    report?.rows.filter(
      (row, index) =>
        !row.group &&
        (["cash", "bank", "government"] as const).some(
          (field) => movement(row, index, field) !== 0,
        ),
    ).length ?? 0;

  const openCell = (
    index: number,
    field: "cash" | "bank" | "government" | "note",
  ) => {
    if (!report) return;
    setRows(report.rows.map((row) => ({ ...row })));
    setCellEdit({ index, field });
    setOperation("add");
    setAmountInput("");
    setNoteInput(report.rows[index].note ?? "");
    setCellError("");
  };
  const applyCell = async () => {
    if (!cellEdit || !school || !report) return;
    const current = report.rows[cellEdit.index];
    let replacement: Row;
    if (cellEdit.field === "note")
      replacement = { ...current, note: noteInput };
    else {
      const amount = Number(amountInput);
      if (amountInput.trim() === "" || !Number.isFinite(amount) || amount < 0) {
        setCellError("กรอกจำนวนเงินตั้งแต่ 0 ขึ้นไป");
        return;
      }
      const original = current[cellEdit.field];
      if (operation === "transfer" && cellEdit.field !== "government") {
        if (amount > original) {
          setCellError("จำนวนที่โอนต้องไม่เกินยอดเดิม");
          return;
        }
        const target = cellEdit.field === "cash" ? "bank" : "cash";
        replacement = {
          ...current,
          [cellEdit.field]: Math.round((original - amount) * 100) / 100,
          [target]: Math.round((current[target] + amount) * 100) / 100,
          note: noteInput,
        };
      } else {
        const result =
          operation === "add"
            ? original + amount
            : operation === "subtract"
              ? original - amount
              : amount;
        if (result < 0) {
          setCellError("ยอดใหม่ต้องไม่ติดลบ");
          return;
        }
        replacement = {
          ...current,
          [cellEdit.field]: Math.round((result + Number.EPSILON) * 100) / 100,
          note: noteInput,
        };
      }
    }
    const updatedRows = report.rows.map((row, index) =>
      index === cellEdit.index ? replacement : row,
    );
    const next = schools.map((item, index) =>
      index === schoolIndex
        ? {
            ...item,
            reports: item.reports.map((day) =>
              day.date === report.date ? { ...day, rows: updatedRows } : day,
            ),
          }
        : item,
    );
    try {
      setSavingReport(true);
      await saveReports([{ date: report.date, rows: updatedRows }]);
      cacheSchools(next);
      setSchools(next);
      setRows(updatedRows);
      setCellEdit(null);
    } catch {
      setCellError("บันทึกขึ้นระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
    } finally {
      setSavingReport(false);
    }
  };
  const carryTarget =
    selectedDay ||
    (currentFiscalYear() === selectedFiscalYear
      ? today()
      : firstDayOfFiscalYear(selectedFiscalYear));
  const carrySource = school?.reports
    .filter((r) => r.date < carryTarget)
    .at(-1);
  const carryExists = school?.reports.some((r) => r.date === carryTarget);
  const openCarryForward = () => {
    setSelectedDay(
      currentFiscalYear() === selectedFiscalYear
        ? today()
        : firstDayOfFiscalYear(selectedFiscalYear),
    );
    setCarryError("");
    setCarryOpen(true);
  };
  const confirmCarryForward = async () => {
    if (!school || !carryTarget || carryExists) return;
    let template: Row[] | null = null;
    try {
      template = JSON.parse(
        scopedStorage.getItem(`school-finance-template:${school.name}`) ||
          "null",
      );
    } catch {
      /* use standard headings */
    }
    const startingRows = carrySource?.rows ?? template ?? exampleRows;
    const newRows = startingRows.map((row) =>
      carrySource
        ? { ...row, note: "" }
        : { ...row, cash: 0, bank: 0, government: 0, note: "" },
    );
    const next = schools.map((item, index) =>
      index === schoolIndex
        ? {
            ...item,
            reports: [
              ...item.reports,
              { date: carryTarget, rows: newRows },
            ].sort((a, b) => a.date.localeCompare(b.date)),
          }
        : item,
    );
    try {
      setSavingReport(true);
      await saveReports([{ date: carryTarget, rows: newRows }]);
      cacheSchools(next);
      setSchools(next);
      setDate(carryTarget);
      setSelectedFiscalYear(fiscalYearOf(carryTarget));
      setCarryOpen(false);
    } catch {
      setCarryError("บันทึกยอดยกมาขึ้นระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ");
    } finally {
      setSavingReport(false);
    }
  };
  const importWorkbook = async (file: File) => {
    setImportMessage("กำลังอ่านไฟล์ Excel…");
    try {
      const imported = await readDailyWorkbook(file);
      setPendingImport(imported);
      setImportMessage("");
    } catch (error) {
      setPendingImport(null);
      setImportMessage(
        error instanceof Error ? error.message : "อ่านไฟล์ Excel ไม่สำเร็จ",
      );
    }
  };
  const confirmImport = async () => {
    if (!pendingImport || importing) return;
    setImporting(true);
    setImportMessage("กำลังบันทึกข้อมูลจาก Excel…");
    try {
      const imported = pendingImport;
      const schoolName = initialSchoolName;
      const index = schools.findIndex((s) => s.name === schoolName);
      const existing =
        index >= 0
          ? schools[index]
          : { name: schoolName, reports: [] as Report[] };
      const dates = new Set(imported.reports.map((r) => r.date));
      const updated: School = {
        ...existing,
        reports: [
          ...existing.reports.filter((r) => !dates.has(r.date)),
          ...imported.reports,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      };
      const next =
        index >= 0
          ? schools.map((s, i) => (i === index ? updated : s))
          : [...schools, updated];
      await saveReports(imported.reports);
      const savedReports = await loadReports();
      const savedByDate = new Map(
        savedReports.map((item) => [item.date, item]),
      );
      if (
        imported.reports.some((item) => {
          const saved = savedByDate.get(item.date);
          return !saved || !sameReportRows(item.rows, saved.rows);
        })
      )
        throw new Error(
          "ระบบยังอ่านข้อมูลที่นำเข้ากลับมาไม่ครบ กรุณาลองโหลดหน้าใหม่ก่อนนำเข้าซ้ำ",
        );
      cacheSchools(next);
      setSchools(next);
      setSchoolIndex(index >= 0 ? index : next.length - 1);
      setDate(imported.reports.at(-1)!.date);
      setSelectedFiscalYear(fiscalYearOf(imported.reports.at(-1)!.date));
      setOpen(false);
      setPendingImport(null);
      setImportMessage(
        `บันทึกและตรวจสอบรายงาน ${imported.reports.length} วันบนระบบแล้ว${imported.skipped.length ? ` · ข้าม ${imported.skipped.length} ชีตที่ไม่ตรงรูปแบบ` : ""}`,
      );
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "นำเข้า Excel ไม่สำเร็จ",
      );
    } finally {
      setImporting(false);
    }
  };
  const totals = (report?.rows ?? []).reduce(
    (sum, r) => ({
      cash: sum.cash + (r.group ? 0 : r.cash),
      bank: sum.bank + (r.group ? 0 : r.bank),
      government: sum.government + (r.group ? 0 : r.government),
    }),
    { cash: 0, bank: 0, government: 0 },
  );
  const begin = (mode: "template" | "balance" = "template", fresh = false) => {
    setFormMode(mode);
    setName(initialSchoolName);
    setPendingImport(null);
    setImportMessage("");
    let template: Row[] | undefined;
    try {
      template = JSON.parse(
        scopedStorage.getItem(`school-finance-template:${school?.name}`) ||
          "null",
      );
    } catch {
      /* use report headings */
    }
    const source = fresh
      ? exampleRows
      : template?.length
        ? template
        : report?.rows?.length
          ? report.rows
          : exampleRows;
    setRows(
      source.map((r) => ({ ...r, cash: 0, bank: 0, government: 0, note: "" })),
    );
    setReportDate(
      currentFiscalYear() === selectedFiscalYear
        ? today()
        : firstDayOfFiscalYear(selectedFiscalYear),
    );
    setError("");
    setOpen(true);
  };
  const save = async () => {
    if (!name.trim() || !rows.length || rows.some((r) => !r.name.trim())) {
      setError("กรอกชื่อโรงเรียนและชื่อประเภทเงินให้ครบ");
      return;
    }
    if (formMode === "template") {
      try {
        const schoolName = name.trim();
        scopedStorage.setItem(
          `school-finance-template:${schoolName}`,
          JSON.stringify(
            rows.map((r) => ({
              ...r,
              cash: 0,
              bank: 0,
              government: 0,
              note: "",
            })),
          ),
        );
        if (!schools.some((item) => item.name === schoolName)) {
          const next = [...schools, { name: schoolName, reports: [] }];
          scopedStorage.setItem("school-finances-v2", JSON.stringify(next));
          setSchools(next);
          setSchoolIndex(next.length - 1);
        }
        setOpen(false);
      } catch {
        setError(
          "บันทึกแบบฟอร์มไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์",
        );
      }
      return;
    }
    const i = schools.findIndex((s) => s.name === name.trim());
    const existing = i >= 0 ? schools[i] : { name: name.trim(), reports: [] };
    const updated = {
      ...existing,
      reports: [
        ...existing.reports.filter((r) => r.date !== reportDate),
        {
          date: reportDate,
          rows: rows.map((r) => ({ ...r, name: r.name.trim() })),
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    };
    const next =
      i >= 0
        ? schools.map((s, index) => (index === i ? updated : s))
        : [...schools, updated];
    try {
      setSavingReport(true);
      await saveReports([
        updated.reports.find((item) => item.date === reportDate)!,
      ]);
      cacheSchools(next);
      setSchools(next);
      setSchoolIndex(i >= 0 ? i : next.length - 1);
      setDate(reportDate);
      setSelectedFiscalYear(fiscalYearOf(reportDate));
      setOpen(false);
    } catch {
      setError("บันทึกขึ้นระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
    } finally {
      setSavingReport(false);
    }
  };
  const createFiscalYear = async (
    year: number,
    carryBalance: boolean,
  ): Promise<string | undefined> => {
    if (!school) return "กรุณาสร้างข้อมูลโรงเรียนก่อน";
    const firstDate = firstDayOfFiscalYear(year);
    const prior = school.reports.filter((item) => item.date < firstDate).at(-1);
    const nextYears = [...new Set([...openedFiscalYears, year])].sort(
      (a, b) => b - a,
    );
    try {
      if (carryBalance) {
        const source =
          prior?.rows ||
          (() => {
            try {
              return JSON.parse(
                scopedStorage.getItem(
                  `school-finance-template:${school.name}`,
                ) || "null",
              ) as Row[] | null;
            } catch {
              return null;
            }
          })() ||
          exampleRows;
        const newReport: Report = {
          date: firstDate,
          rows: source.map((row) => ({
            ...row,
            cash: prior ? row.cash : 0,
            bank: prior ? row.bank : 0,
            government: prior ? row.government : 0,
            note: "",
          })),
        };
        await saveReports([newReport]);
        const next = schools.map((item, index) =>
          index === schoolIndex
            ? {
                ...item,
                reports: [...item.reports, newReport].sort((a, b) =>
                  a.date.localeCompare(b.date),
                ),
              }
            : item,
        );
        cacheSchools(next);
        setSchools(next);
      }
      scopedStorage.setItem(
        `school-fiscal-years:${school.name}`,
        JSON.stringify(nextYears),
      );
      setOpenedFiscalYears(nextYears);
      setSelectedFiscalYear(year);
      setDate(carryBalance ? firstDate : "");
      return undefined;
    } catch {
      return "เปิดปีงบประมาณไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อระบบ";
    }
  };
  const downloadConflictBackup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(conflictBackup, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `budget-report-backup-${initialSchoolName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (reportLoading)
    return (
      <div className="grid h-dvh place-items-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-300">
        กำลังเรียกรายงานงบประมาณจากระบบ…
      </div>
    );
  return (
    <div className={`flex min-h-0 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/40 text-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 dark:text-slate-100 print:h-auto print:overflow-visible print:bg-white print:text-black ${demo ? "h-[calc(100dvh-3.5rem)]" : "h-dvh"}`}>
      <Header
        demo={demo}
        onLogin={onLogin}
        active={active}
        schoolName={school?.name}
        onMenu={onMenu}
        dark={dark}
        onToggleDark={onToggleDark}
        fiscalYear={selectedFiscalYear}
        fiscalYears={fiscalYears}
        onFiscalYearChange={(year) => {
          setSelectedFiscalYear(year);
          setDate("");
        }}
        onCreateFiscalYear={createFiscalYear}
      />
      <main className={`mx-auto min-h-0 w-full flex-1 overscroll-contain print:hidden ${pathname.endsWith("/contact") || pathname.endsWith("/gimini-ai") ? "flex max-w-none flex-col overflow-hidden p-2 sm:p-4" : "max-w-[1360px] space-y-7 overflow-y-auto p-4 sm:p-8 lg:px-10 lg:pb-10 lg:pt-6"}`}>
        {viewAsUid && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
          >
            <span>
              <strong>กำลังสวมสิทธิ์ {school?.name}</strong> ·
              การแก้ไขจะบันทึกในบัญชีผู้ใช้นี้
            </span>
            <button
              onClick={() => onNavigate("Dashboard")}
              className="rounded-lg bg-white px-3 py-1.5 font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-300"
            >
              กลับ Dashboard
            </button>
          </div>
        )}
        {syncError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <span>{syncError}</span>
            {conflictBackup.length > 0 && (
              <button
                type="button"
                onClick={downloadConflictBackup}
                className="rounded-lg border border-amber-300 px-3 py-1.5 font-semibold dark:border-amber-700"
              >
                ดาวน์โหลดสำเนาข้อมูลในเครื่อง
              </button>
            )}
          </div>
        )}
        <FinancePageProvider
          value={{
            importMessage,
            school: school?.name ?? "โรงเรียนของคุณ",
            schoolKey: school?.name ?? "new-school",
            fiscalYear: selectedFiscalYear,
            report,
            yearReports,
            categories: [
              ...new Set(
                (report?.rows || school?.reports.at(-1)?.rows || exampleRows)
                  .filter((row) => !row.group)
                  .map((row) => row.name),
              ),
            ],
            reportFormDate:
              report?.date ??
              (currentFiscalYear() === selectedFiscalYear
                ? today()
                : firstDayOfFiscalYear(selectedFiscalYear)),
            onPreview: report ? () => setPreviewOpen(true) : undefined,
            onNavigate,
            overview: (
              <>
        {!report ? (
          <section className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <GraduationCap size={32} />
            </span>
            <h2 className="text-xl font-medium">
              {school
                ? `ยังไม่มีรายงานปีงบประมาณ ${selectedFiscalYear}`
                : "เริ่มต้นข้อมูลของโรงเรียน"}
            </h2>
            <p className="mt-3 text-slate-500">
              {school
                ? "สร้างรายงานวันแรกของปีนี้จากแบบฟอร์มโรงเรียน แล้วกรอกยอดตั้งต้น"
                : "เพิ่มชื่อโรงเรียน ประเภทเงิน และยอดคงเหลือครั้งแรก"}
            </p>
            <button
              onClick={() => begin(school ? "balance" : "template")}
              className="mt-6 rounded-lg bg-blue-700 px-5 py-3 text-white"
            >
              {school ? "สร้างรายงานปีนี้" : "สร้างแบบฟอร์มของโรงเรียน"}
            </button>
          </section>
        ) : (
          <>
            <section
              aria-label="สรุปยอดเงินคงเหลือ"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                {[
                  {
                    label: "เงินคงเหลือรวม",
                    amount: totals.cash + totals.bank + totals.government,
                    Icon: Wallet,
                    tone: "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:border-blue-900 dark:from-blue-950 dark:via-slate-900 dark:to-cyan-950",
                    badge:
                      "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
                    line: "bg-blue-500",
                  },
                  {
                    label: "เงินสด",
                    amount: totals.cash,
                    Icon: Banknote,
                    tone: "border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 dark:border-teal-900 dark:from-teal-950 dark:via-slate-900 dark:to-emerald-950",
                    badge:
                      "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200",
                    line: "bg-teal-500",
                  },
                  {
                    label: "เงินฝากธนาคาร",
                    amount: totals.bank,
                    Icon: Landmark,
                    tone: "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:border-violet-900 dark:from-violet-950 dark:via-slate-900 dark:to-blue-950",
                    badge:
                      "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200",
                    line: "bg-violet-500",
                  },
                  {
                    label: "เงินฝากส่วนราชการผู้เบิก",
                    amount: totals.government,
                    Icon: Building2,
                    tone: "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-900 dark:from-amber-950 dark:via-slate-900 dark:to-orange-950",
                    badge:
                      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
                    line: "bg-amber-500",
                  },
                ].map(({ label, amount, Icon, tone, badge, line }) => (
                  <article
                    key={label}
                    className={`group relative min-w-0 overflow-hidden rounded-2xl border p-5 shadow-sm motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/10 dark:hover:shadow-blue-950/30 ${tone}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`absolute -right-9 -top-9 size-32 rounded-full opacity-30 blur-2xl ${line}`}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <p className="min-h-10 text-sm font-medium leading-5 text-slate-600 dark:text-slate-300">
                        {label}
                      </p>
                      <span
                        className={`grid size-11 shrink-0 place-items-center rounded-xl motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-6 motion-safe:group-hover:scale-110 ${badge}`}
                      >
                        <Icon size={22} strokeWidth={1.8} />
                      </span>
                    </div>
                    <strong className="relative mt-4 block break-words text-[clamp(1.35rem,2vw,1.85rem)] font-bold tracking-tight tabular-nums">
                      ฿ <AnimatedNumber value={amount} format={money} />
                    </strong>
                    <div className="relative mt-5 flex items-center gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
                      <span className={`size-1.5 rounded-full ${line}`} /> ณ
                      วันที่ {thaiDate(report.date)}
                    </div>
                  </article>
                ))}
            </section>
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-blue-100/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold">
                    รายงานเงินคงเหลือประจำวัน
                  </h2>
                  <p className="text-sm text-slate-500">
                    ยอดคงเหลือประจำวันที่ {thaiDate(report.date)}
                    {previousReport &&
                      ` · เคลื่อนไหว ${movementCount} รายการจาก ${thaiDate(previousReport.date)}`}
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  <label className="col-span-2 grid gap-1 text-sm font-medium sm:col-span-1">
                    <ThaiDatePicker
                      value={report.date}
                      availableDates={yearReports.map((r) => r.date)}
                      onChange={(selected) => {
                        setDate(selected);
                        setImportMessage("");
                      }}
                    />
                  </label>
                  <button
                    onClick={() => begin("template")}
                    className="h-12 min-w-40 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium motion-safe:transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    แก้ไขรายการฟอร์ม
                  </button>
                  <button
                    onClick={openCarryForward}
                    className="h-12 min-w-40 rounded-xl border border-blue-600 px-4 text-sm font-medium text-blue-700 motion-safe:transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-sm dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    + เพิ่มวันใหม่
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse text-left text-sm tabular-nums">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      {[
                        "ประเภทเงิน",
                        "เงินสด",
                        "เงินฝากธนาคาร",
                        "เงินฝากส่วนราชการผู้เบิก",
                        "รวม",
                        "หมายเหตุ",
                      ].map((label, index) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-5 py-3 font-semibold ${index > 0 && index < 5 ? "text-right" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[report].map((day) => {
                      const amounts = day.rows.reduce(
                        (sum, row) => ({
                          cash: sum.cash + (row.group ? 0 : row.cash),
                          bank: sum.bank + (row.group ? 0 : row.bank),
                          government:
                            sum.government + (row.group ? 0 : row.government),
                        }),
                        { cash: 0, bank: 0, government: 0 },
                      );
                      return (
                        <Fragment key={day.date}>
                          {day.rows.map((row, i) => {
                            const deltas = (
                              ["cash", "bank", "government"] as const
                            ).map((field) => movement(row, i, field));
                            const changed = deltas.some((delta) => delta !== 0);
                            const totalDelta = deltas.reduce(
                              (sum, delta) => sum + delta,
                              0,
                            );
                            return (
                              <tr
                                key={`${day.date}-${i}`}
                                className={`transition-colors duration-200 ${
                                  changed
                                    ? "bg-amber-50/60 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/35"
                                    : "hover:bg-blue-50/70 dark:hover:bg-slate-800/60"
                                }`}
                              >
                                <th
                                  scope="row"
                                  className={`px-5 py-4 ${row.group ? "font-bold text-blue-700 dark:text-blue-300" : "font-medium"}`}
                                >
                                  <span
                                    className="block"
                                    style={{
                                      paddingLeft: `${(row.level ?? 0) * 20}px`,
                                    }}
                                  >
                                    {row.name}
                                  </span>
                                </th>
                                {(["cash", "bank", "government"] as const).map(
                                  (field) => {
                                    const delta = movement(row, i, field);
                                    return (
                                      <td
                                        key={field}
                                        className="px-3 py-2 text-right"
                                      >
                                        <div className="flex flex-col items-end gap-1">
                                          {row.group ? (
                                            null
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => openCell(i, field)}
                                              aria-label={`แก้ไข ${field} ${row.name}`}
                                              className="min-w-28 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-right font-medium text-blue-800 hover:border-blue-500 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
                                            >
                                              {money(row[field])}
                                            </button>
                                          )}
                                          {delta !== 0 && (
                                            <span
                                              className={`text-xs font-semibold ${delta > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
                                            >
                                              {delta > 0 ? "▲" : "▼"}{" "}
                                              {money(Math.abs(delta))}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  },
                                )}
                                <td className="px-5 py-4 text-right font-semibold">
                                  {row.group
                                    ? null
                                    : money(
                                        row.cash + row.bank + row.government,
                                      )}
                                  {totalDelta !== 0 && (
                                    <span
                                      className={`block text-xs ${totalDelta > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
                                    >
                                      {totalDelta > 0 ? "▲" : "▼"}{" "}
                                      {money(Math.abs(totalDelta))}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {row.group ? (
                                    null
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => openCell(i, "note")}
                                      className={`min-w-24 rounded-lg border px-3 py-2 text-left hover:border-blue-500 ${row.note?.trim() ? "border-blue-200 bg-blue-50 font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"}`}
                                    >
                                      {row.note || "เพิ่มหมายเหตุ"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-50 font-semibold dark:bg-slate-800/70">
                            <th scope="row" className="px-5 py-4 text-left">
                              รวมทั้งสิ้น
                            </th>
                            <td className="px-5 py-4 text-right">
                              {money(amounts.cash)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {money(amounts.bank)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              {money(amounts.government)}
                            </td>
                            <td className="px-5 py-4 text-right text-blue-700 dark:text-blue-300">
                              {money(balanceOf(day))}
                            </td>
                            <td />
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-medium text-white shadow-sm hover:bg-blue-800"
              >
                <FileSpreadsheet size={19} /> ดูตัวอย่างและส่งออกตาราง
              </button>
            </div>
          </>
        )}
              </>
            ),
          }}
        >
          <Outlet />
        </FinancePageProvider>
      </main>
      {previewOpen && report && (
        <DailyReportExport
          school={school.name}
          date={report.date}
          rows={report.rows}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {cellEdit && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cell-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
          >
            <h2 id="cell-title" className="text-lg font-semibold">
              {rows[cellEdit.index].name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {cellEdit.field === "note"
                ? "แก้ไขหมายเหตุ"
                : {
                    cash: "เงินสด",
                    bank: "เงินฝากธนาคาร",
                    government: "เงินฝากส่วนราชการผู้เบิก",
                  }[cellEdit.field]}
            </p>
            {cellEdit.field === "note" ? (
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={4}
                className={`${input} mt-4`}
                placeholder="หมายเหตุ"
              />
            ) : (
              <>
                <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="text-sm text-slate-500">ยอดเดิม</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    ฿ {money(rows[cellEdit.index][cellEdit.field])}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["add", "+ เพิ่ม"],
                      ["subtract", "− ลด"],
                      cellEdit.field === "government"
                        ? ["set", "= กำหนดใหม่"]
                        : [
                            "transfer",
                            cellEdit.field === "cash"
                              ? "นำเข้าธนาคาร"
                              : "ถอนเงินสด",
                          ],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setOperation(
                          value as "add" | "subtract" | "set" | "transfer",
                        );
                        setCellError("");
                      }}
                      className={`rounded-lg border px-2 py-3 text-sm font-medium ${operation === value ? "border-blue-700 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-300 dark:border-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="mt-4 grid gap-2 text-sm">
                  จำนวนเงิน
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setCellError("");
                    }}
                    className={input}
                    placeholder="0.00"
                  />
                </label>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 p-3 font-semibold dark:bg-blue-950">
                  <span>ยอดใหม่</span>
                  <output className="tabular-nums">
                    ฿{" "}
                    {money(
                      operation === "set"
                        ? Number(amountInput || 0)
                        : rows[cellEdit.index][cellEdit.field] +
                            (operation === "add" ? 1 : -1) *
                              Number(amountInput || 0),
                    )}
                  </output>
                </div>
                {operation === "transfer" &&
                  cellEdit.field !== "government" && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {cellEdit.field === "cash" ? "เงินฝากธนาคาร" : "เงินสด"}
                      หลังโอน: ฿{" "}
                      {money(
                        rows[cellEdit.index][
                          cellEdit.field === "cash" ? "bank" : "cash"
                        ] + Number(amountInput || 0),
                      )}
                    </p>
                  )}
                <label className="mt-4 grid gap-2 text-sm">
                  หมายเหตุ
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    rows={2}
                    className={input}
                    placeholder="ใส่หมายเหตุได้ในครั้งเดียว"
                  />
                </label>
              </>
            )}
            {cellError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {cellError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCellEdit(null)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 dark:border-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={applyCell}
                disabled={savingReport}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-white disabled:opacity-50"
              >
                {savingReport ? "กำลังบันทึก…" : "ใช้ค่านี้"}
              </button>
            </div>
          </section>
        </div>
      )}
      {carryOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="carry-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <h2 id="carry-title" className="text-xl font-semibold">
              เพิ่มวันใหม่
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              เลือกวันที่ต้องการเพิ่ม
              ระบบจะใช้ยอดคงเหลือจากวันก่อนหน้าล่าสุดเป็นค่าเริ่มต้น
              จากนั้นแตะยอดในตารางเพื่อแก้ไขได้
              หากไม่มีรายการเคลื่อนไหวก็ใช้ยอดเดิมได้เลย
            </p>
            <label className="mt-5 grid gap-2 text-sm font-medium">
              วันที่ต้องการสร้างรายงาน
              <ThaiDatePicker
                value={carryTarget}
                onChange={(selected) => {
                  setSelectedDay(selected);
                  setCarryError("");
                }}
              />
            </label>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
              <p>
                ยอดตั้งต้นจาก{" "}
                <strong>
                  {carrySource
                    ? thaiDate(carrySource.date)
                    : "แบบฟอร์มของโรงเรียน (เริ่มที่ 0 บาท)"}
                </strong>
              </p>
              <p className="mt-1">
                ไปวันที่ <strong>{thaiDate(carryTarget)}</strong>
              </p>
              {carrySource && (
                <p className="mt-2 font-semibold">
                  ยอดคงเหลือ ฿ {money(balanceOf(carrySource))}
                </p>
              )}
            </div>
            {carryExists && (
              <p
                role="alert"
                className="mt-3 text-sm text-amber-700 dark:text-amber-300"
              >
                วันที่นี้มีรายงานแล้ว กรุณาเลือกวันอื่น
              </p>
            )}
            {carryError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {carryError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCarryOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 dark:border-slate-700"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!carryTarget || Boolean(carryExists) || savingReport}
                onClick={confirmCarryForward}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                สร้างรายงานวันใหม่
              </button>
            </div>
          </section>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 p-5 dark:border-slate-700">
              <h2 className="text-lg font-semibold">
                {formMode === "template" ? "แก้ไขรายการฟอร์ม" : "กรอกยอดรายวัน"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                disabled={importing}
              >
                <X />
              </button>
            </header>
            <div className="min-h-0 space-y-5 overflow-auto p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  ชื่อโรงเรียน
                  <input required value={name} readOnly className={input} />
                </label>
                {formMode === "balance" && (
                  <label className="space-y-2 text-sm">
                    วันที่รายงาน
                    <input required type="hidden" value={reportDate} />
                    <ThaiDatePicker
                      value={reportDate}
                      onChange={setReportDate}
                    />
                  </label>
                )}
              </div>
              {formMode === "balance" && (
                <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
                  <h3 className="font-semibold">นำเข้ายอดรายวันจาก Excel</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    เลือกไฟล์เพื่อดูจำนวนวันที่นำเข้า
                    ก่อนยืนยันบันทึกทุกวันที่มีในชีต
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white">
                    <FileSpreadsheet size={18} /> นำเข้า Excel
                    <input
                      className="sr-only"
                      type="file"
                      accept=".xlsx,.xls"
                      aria-label="นำเข้า Excel"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void importWorkbook(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {importMessage && (
                    <p role="status" className="mt-2 text-sm">
                      {importMessage}
                    </p>
                  )}
                  {pendingImport && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4 text-sm dark:border-blue-800 dark:bg-slate-900">
                      <p className="font-semibold">
                        พบรายงาน {pendingImport.reports.length} วัน
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        {thaiDate(pendingImport.reports[0].date)} –{" "}
                        {thaiDate(pendingImport.reports.at(-1)!.date)}
                        {pendingImport.reports.filter((item) =>
                          school?.reports.some(
                            (saved) => saved.date === item.date,
                          ),
                        ).length > 0 &&
                          ` · จะเขียนทับวันที่มีอยู่ ${pendingImport.reports.filter((item) => school?.reports.some((saved) => saved.date === item.date)).length} วัน`}
                        {pendingImport.skipped.length > 0 &&
                          ` · ข้าม ${pendingImport.skipped.length} ชีต`}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmImport()}
                          disabled={importing}
                          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          {importing
                            ? "กำลังนำเข้า…"
                            : `ยืนยันนำเข้า ${pendingImport.reports.length} วัน`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingImport(null);
                            setImportMessage("");
                          }}
                          disabled={importing}
                          className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
              {formMode === "template" ? (
                <>
                  {rows.map((row, i) => (
                    <article
                      key={i}
                      className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <label className="text-sm">
                          ชื่อหัวข้อ / รายการ
                          <input
                            required
                            aria-label={`ชื่อรายการที่ ${i + 1}`}
                            placeholder="ชื่อรายการ"
                            value={row.name}
                            onChange={(e) =>
                              setRows(
                                rows.map((r, j) =>
                                  j === i ? { ...r, name: e.target.value } : r,
                                ),
                              )
                            }
                            className={input}
                          />
                        </label>
                        <button
                          type="button"
                          aria-label={`ลบ ${row.name || "รายการใหม่"}`}
                          onClick={() =>
                            setRows(rows.filter((_, j) => j !== i))
                          }
                          className="self-end rounded-lg border border-slate-300 p-3 text-slate-500 dark:border-slate-600"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(row.group)}
                            onChange={(e) =>
                              setRows(
                                rows.map((r, j) =>
                                  j === i
                                    ? {
                                        ...r,
                                        group: e.target.checked,
                                        cash: e.target.checked ? 0 : r.cash,
                                        bank: e.target.checked ? 0 : r.bank,
                                        government: e.target.checked
                                          ? 0
                                          : r.government,
                                      }
                                    : r,
                                ),
                              )
                            }
                          />{" "}
                          เป็นหัวข้อจัดกลุ่ม
                        </label>
                        <label className="flex items-center gap-2">
                          ระดับ{" "}
                          <select
                            value={row.level ?? 0}
                            onChange={(e) =>
                              setRows(
                                rows.map((r, j) =>
                                  j === i
                                    ? { ...r, level: Number(e.target.value) }
                                    : r,
                                ),
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
                          >
                            <option value={0}>ประเภทหลัก</option>
                            <option value={1}>หัวข้อย่อย</option>
                            <option value={2}>รายการย่อย</option>
                          </select>
                        </label>
                      </div>
                    </article>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setRows([
                        ...rows,
                        { name: "", cash: 0, bank: 0, government: 0, level: 0 },
                      ])
                    }
                    className="w-full rounded-lg border border-dashed border-blue-400 p-3 text-blue-700 dark:text-blue-300"
                  >
                    + เพิ่มรายการ
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500">
                    เลือกประเภทเงินแล้วกรอกยอด ช่องรวมจะคำนวณให้อัตโนมัติ
                  </p>
                  {rows.map((row, i) =>
                    row.group ? (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-100 px-4 py-3 font-semibold dark:bg-slate-800"
                        style={{ marginLeft: `${(row.level ?? 0) * 12}px` }}
                      >
                        {row.name}
                      </div>
                    ) : (
                      <article
                        key={i}
                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <h3
                          className="mb-4 font-semibold"
                          style={{ marginLeft: `${(row.level ?? 0) * 12}px` }}
                        >
                          {row.name}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {(["cash", "bank", "government"] as const).map(
                            (field, j) => (
                              <label
                                key={field}
                                className="grid gap-1 text-sm text-slate-600 dark:text-slate-300"
                              >
                                {
                                  [
                                    "เงินสด",
                                    "ธนาคาร",
                                    "เงินฝากส่วนราชการผู้เบิก",
                                  ][j]
                                }
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={row[field]}
                                  onChange={(e) =>
                                    setRows(
                                      rows.map((r, k) =>
                                        k === i
                                          ? {
                                              ...r,
                                              [field]: Number(e.target.value),
                                            }
                                          : r,
                                      ),
                                    )
                                  }
                                  className={input}
                                />
                              </label>
                            ),
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                          <span>รวม</span>
                          <output className="tabular-nums">
                            {money(row.cash + row.bank + row.government)} บาท
                          </output>
                        </div>
                        <label className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                          หมายเหตุ
                          <input
                            value={row.note ?? ""}
                            onChange={(e) =>
                              setRows(
                                rows.map((r, k) =>
                                  k === i ? { ...r, note: e.target.value } : r,
                                ),
                              )
                            }
                            className={input}
                          />
                        </label>
                      </article>
                    ),
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="text-red-600">
                  {error}
                </p>
              )}
            </div>
            <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={importing}
                className="rounded-lg px-4 py-3"
              >
                ยกเลิก
              </button>
              <button
                disabled={savingReport || importing || Boolean(pendingImport)}
                className="rounded-lg bg-blue-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {savingReport
                  ? "กำลังบันทึก…"
                  : formMode === "template"
                    ? "บันทึกแบบฟอร์ม"
                    : "บันทึกยอดรายวัน"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
