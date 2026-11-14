import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  FileSpreadsheet,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useFinancePage } from "../schoolFinance/financePageState";
import { loadDemoReports, saveDemoReports } from "../../features/auth/demoFinanceStore";
import {
  currentFiscalYear,
  fiscalYearOf,
  firstDayOfFiscalYear,
  todayIso,
} from "../../shared/funtion/fiscalYear";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import { readProjectWorkbook } from "./readProjectWorkbook";
import ProjectEditor from "./ProjectEditor";
import ActivityBalanceCard from "./ActivityBalanceCard";
import {
  newId,
  projectBudget,
  projectExpenseId,
  type SchoolProject,
} from "./projectModel";
import { formatMoneyInput, parseMoneyInput } from "./moneyFormat";
import { deleteProject as deleteRemoteProject, deleteProjectAttachment, downloadProjectAttachment, loadProjects, removeProjectExpense, saveProject, saveProjectExpense, uploadProjectAttachment, type ProjectAttachment, type ProjectExpense } from "../../config/services/projects.service";

const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
const input =
  "mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold";
const saveError = (cause: unknown) => axios.isAxiosError(cause) && cause.response?.status === 409
  ? "ข้อมูลถูกแก้ไขจากอีกเครื่อง กรุณารีเฟรชหน้าแล้วลองใหม่"
  : axios.isAxiosError(cause) && cause.response?.status === 422
    ? "ปรับยอดรายวันไม่ได้ กรุณาตรวจประเภทเงิน ช่องทางจ่าย และยอดคงเหลือของวันที่เลือก"
  : "บันทึกข้อมูลโครงการไม่สำเร็จ กรุณาลองใหม่";
type ExpenseDraft = {
  activityId: string;
  allocationId: string;
  date: string;
  category: string;
  description: string;
  amount: string;
  documentNo: string;
  account: "cash" | "bank" | "government" | "";
  attachment?: ProjectAttachment;
};
type PreviewExpense = ProjectExpense;

function updateDemoExpense(previous?: PreviewExpense, next?: PreviewExpense) {
  const reports = loadDemoReports();
  const changes = new Map<string, typeof reports[number]>();
  for (const [expense, amount] of [[previous, previous?.amount], [next, next ? -next.amount : undefined]] as const) {
    if (!expense || amount === undefined || !expense.account) continue;
    const report = changes.get(expense.date) || reports.find((item) => item.date === expense.date) || [...reports].filter((item) => item.date < expense.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!report) throw new Error("ไม่พบรายงานเงินคงเหลือสำหรับวันที่เลือก");
    const base = report.date === expense.date ? report : { ...report, date: expense.date, rows: report.rows.map((row) => ({ ...row, note: "" })) };
    let found = false;
    const rows = base.rows.map((row) => {
      if (row.group || row.name !== expense.category) return row;
      found = true;
      const updated = row[expense.account!] + amount;
      if (updated < 0) throw new Error("ยอดคงเหลือไม่พอจ่าย");
      const notes = row.note ? row.note.split("\n") : [];
      if (amount > 0) { const index = notes.indexOf(expense.note); if (index >= 0) notes.splice(index, 1); }
      else notes.push(expense.note);
      return { ...row, [expense.account!]: updated, note: notes.join("\n") };
    });
    if (!found) throw new Error("ไม่พบประเภทเงินในรายงาน");
    changes.set(expense.date, { ...base, rows });
  }
  if (changes.size) saveDemoReports([...reports.filter((item) => !changes.has(item.date)), ...changes.values()]);
}

export default function ProjectWorkspacePage() {
  const { fiscalYear, yearReports, user, viewAsUid, demo, tourActive } = useFinancePage();
  const [projects, setProjects] = useState<SchoolProject[]>([]);
  const [expenses, setExpenses] = useState<PreviewExpense[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<SchoolProject | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<SchoolProject[] | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("ทั้งหมด");
  const [error, setError] = useState("");
  const scope = demo ? "demo" : `${user?.uid || ""}:${viewAsUid || ""}`;
  const [loadedScope, setLoadedScope] = useState(demo ? "demo" : "");
  const loading = loadedScope !== scope;
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (demo) {
      let active = true;
      queueMicrotask(() => { if (active) { setProjects([]); setExpenses([]); setSelectedId(""); setLoadedScope("demo"); } });
      return () => { active = false; };
    }
    if (!user) return;
    let active = true;
    void loadProjects(user, viewAsUid).then((records) => {
      if (!active) return;
      setProjects(records.map((record) => record.project));
      setExpenses(records.flatMap((record) => record.expenses));
      setSelectedId("");
      setLoadedScope(scope);
    }).catch(() => { if (active) { setProjects([]); setExpenses([]); setError("โหลดโครงการจากระบบไม่สำเร็จ กรุณาลองใหม่"); setLoadedScope(scope); } });
    return () => { active = false; };
  }, [demo, user, viewAsUid, scope]);
  const tourProject: SchoolProject = { id: "tour-project", fiscalYear, name: "โครงการพัฒนาสื่อการเรียน", department: "ฝ่ายวิชาการ", owner: "ครูตัวอย่าง", activities: [
    { id: "tour-internet", name: "ค่าอินเทอร์เน็ต", allocations: [{ id: "tour-allocation", category: "เงินอุดหนุนค่าใช้จ่ายรายหัว", budget: 15000 }] },
    { id: "tour-equipment", name: "อุปกรณ์การเรียน", allocations: [{ id: "tour-equipment-allocation", category: "เงินอุดหนุนค่าใช้จ่ายรายหัว", budget: 5000 }] },
  ] };
  const displayProjects = (tourActive || demo) && projects.length === 0 ? [tourProject] : projects;
  const selected = displayProjects.find((project) => project.id === selectedId && project.fiscalYear === fiscalYear);
  const firstFundedActivity = selected?.activities.find(
    (activity) => activity.allocations.length,
  );
  const expenseActivity = selected?.activities.find(
    (activity) => activity.id === expenseDraft?.activityId,
  );
  const expenseAllocation = expenseActivity?.allocations.find(
    (allocation) => allocation.id === expenseDraft?.allocationId,
  );
  const categories = useMemo(
    () => [
      ...new Set(
        yearReports.flatMap((report) =>
          report.rows.filter((row) => !row.group).map((row) => row.name),
        ),
      ),
    ],
    [yearReports],
  );
  const yearProjects = displayProjects.filter((project) => project.fiscalYear === fiscalYear);
  const departments = [
    ...new Set(yearProjects.map((project) => project.department).filter(Boolean)),
  ];
  const expenseFor = (projectId: string) =>
    expenses.filter((entry) => entry.id.startsWith(`pexp_${projectId}_`));
  const spent = (projectId: string) =>
    expenseFor(projectId).reduce((sum, entry) => sum + entry.amount, 0);
  const yearExpenses = expenses.filter((entry) => yearProjects.some((project) => entry.id.startsWith(`pexp_${project.id}_`)));
  const plannedTotal = yearProjects.reduce((sum, project) => sum + projectBudget(project), 0);
  const spentTotal = yearExpenses.reduce((sum, entry) => sum + entry.amount, 0);
  const spentByCategory = Object.entries(yearExpenses.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
    return totals;
  }, {})).sort((a, b) => b[1] - a[1]);
  const visible = yearProjects.filter(
    (project) =>
      (department === "ทั้งหมด" || department === project.department) &&
      `${project.name} ${project.owner} ${project.department}`
        .toLocaleLowerCase("th")
        .includes(query.toLocaleLowerCase("th")),
  );
  const reportBalance = (date: string, category: string, account: ExpenseDraft["account"]) => {
    const row = [...yearReports]
      .filter((report) => report.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
      ?.rows.find((item) => !item.group && item.name === category);
    return row ? account === "cash" ? row.cash : account === "bank" ? row.bank : account === "government" ? row.government : undefined : undefined;
  };
  const reportAmount = expenseDraft
    ? reportBalance(expenseDraft.date, expenseDraft.category, expenseDraft.account)
    : undefined;
  const previousDraftExpense = expenses.find((item) => item.id === editingExpenseId);
  const currentReportBalance =
    reportAmount === undefined
      ? undefined
      : reportAmount + (previousDraftExpense && previousDraftExpense.account === expenseDraft?.account && previousDraftExpense.date === expenseDraft?.date ? previousDraftExpense.amount : 0);
  const enteredAmount = expenseDraft ? parseMoneyInput(expenseDraft.amount) : 0;
  const projectedBalance =
    currentReportBalance === undefined
      ? undefined
      : currentReportBalance -
        (Number.isFinite(enteredAmount) ? enteredAmount : 0);

  const persistProject = async (project: SchoolProject, projectExpenses: PreviewExpense[]) => {
    if (demo) return project;
    if (!user) throw new Error("not_signed_in");
    return saveProject(user, project, projectExpenses, viewAsUid);
  };
  const openEditor = (project?: SchoolProject) => {
    setError("");
    setDraft(
      project
        ? structuredClone(project)
        : { id: newId(), fiscalYear, name: "", department: "", owner: "", activities: [] },
    );
  };
  useEffect(() => {
    const showStep = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; title: string }>).detail;
      if (detail?.path !== "/finance/projects") return;
      setDraft(null);
      setExpenseDraft(null);
      if (detail.title === "เพิ่มโครงการหรือนำเข้า Excel" || detail.title === "กำหนดวงเงินรายกิจกรรม") openEditor(tourProject);
      if (detail.title === "เพิ่มค่าใช้จ่ายกิจกรรม") {
        setSelectedId(tourProject.id);
        setExpenseDraft({ activityId: "tour-internet", allocationId: "tour-allocation", date: todayIso(), category: "เงินอุดหนุนค่าใช้จ่ายรายหัว", account: "bank", description: "ค่าอินเทอร์เน็ต", amount: "1,200.00", documentNo: "" });
      }
    };
    window.addEventListener("thaiteacher:tour-step", showStep);
    return () => window.removeEventListener("thaiteacher:tour-step", showStep);
  });
  useEffect(() => {
    if (tourActive) return;
    const reset = window.setTimeout(() => {
      if (selectedId === "tour-project") setSelectedId("");
      if (draft?.id === "tour-project") setDraft(null);
      if (expenseDraft?.activityId === "tour-internet") setExpenseDraft(null);
    }, 0);
    return () => window.clearTimeout(reset);
  }, [tourActive, selectedId, draft?.id, expenseDraft?.activityId]);
  const saveDraft = async () => {
    if (!draft?.name.trim()) {
      setError("กรอกชื่อโครงการ");
      return;
    }
    if (
      draft.activities.some(
        (activity) =>
          !activity.name.trim() ||
          activity.allocations.some(
            (allocation) =>
              !Number.isFinite(allocation.budget) || allocation.budget < 0,
          ) ||
          new Set(
            activity.allocations
              .map((allocation) => allocation.category)
              .filter(Boolean),
          ).size !==
            activity.allocations.filter((allocation) => allocation.category)
              .length,
      )
    ) {
      setError(
        "กรอกชื่อกิจกรรมและวงเงินให้ถูกต้อง โดยไม่เลือกประเภทเงินซ้ำในกิจกรรมเดียวกัน",
      );
      return;
    }
    const recorded = expenseFor(draft.id);
    if (
      recorded.some(
        (entry) =>
          !draft.activities.some((activity) =>
            entry.id.startsWith(projectExpenseId(draft.id, activity.id)),
          ),
      )
    ) {
      setError("ลบกิจกรรมที่มีค่าใช้จ่ายแล้วไม่ได้");
      return;
    }
    if (
      recorded.some((entry) => {
        const activity = draft.activities.find((item) =>
          entry.id.startsWith(projectExpenseId(draft.id, item.id)),
        );
        const allocation = activity?.allocations.find(
          (item) => item.category === entry.category,
        );
        return (
          !allocation ||
          allocation.budget <
            recorded
              .filter(
                (item) =>
                  item.id.startsWith(
                    projectExpenseId(draft.id, activity!.id),
                  ) && item.category === entry.category,
              )
              .reduce((sum, item) => sum + item.amount, 0)
        );
      })
    ) {
      setError("ต้องคงแหล่งเงินและวงเงินของกิจกรรมที่มีค่าใช้จ่ายแล้ว");
      return;
    }
    setSaving(true);
    try {
      const saved = await persistProject(draft, recorded);
      setProjects((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setSelectedId(draft.id);
      setDraft(null);
      setError("");
    } catch (cause) { setError(saveError(cause)); }
    finally { setSaving(false); }
  };
  const removeProject = async (project: SchoolProject) => {
    if (expenseFor(project.id).length) {
      setError("โครงการนี้มีค่าใช้จ่ายแล้ว จึงลบไม่ได้");
      return;
    }
    if (!window.confirm(`ลบ ${project.name} ?`)) return;
    setSaving(true);
    try {
      if (!demo) { if (!user) throw new Error("not_signed_in"); await deleteRemoteProject(user, project, viewAsUid); }
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setSelectedId("");
      setError("");
    } catch (cause) { setError(saveError(cause)); }
    finally { setSaving(false); }
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      setImportPreview(await readProjectWorkbook(file, fiscalYear));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่าน Excel ไม่สำเร็จ");
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const importProjects = async () => {
    if (!importPreview) return;
    const keys = new Set(
      projects.map((item) =>
        `${item.fiscalYear}|${item.department}|${item.name}`.toLocaleLowerCase("th"),
      ),
    );
    const added = importPreview.filter(
      (item) =>
        !keys.has(`${item.fiscalYear}|${item.department}|${item.name}`.toLocaleLowerCase("th")),
    );
    if (!added.length) {
      setError("โครงการจากไฟล์มีอยู่แล้วทั้งหมด");
      setImportPreview(null);
      return;
    }
    setSaving(true);
    try {
      for (const item of added) {
        const saved = await persistProject(item, []);
        setProjects((current) => [...current, saved]);
      }
      setImportPreview(null);
      setError("");
    } catch (cause) { setError(saveError(cause)); }
    finally { setSaving(false); }
  };
  const saveExpense = async () => {
    if (!selected || !expenseDraft) return;
    const amount = parseMoneyInput(expenseDraft.amount);
    if (
      !expenseDraft.activityId ||
      !expenseDraft.description.trim() ||
      !expenseDraft.category ||
      !expenseDraft.account ||
      !expenseDraft.date ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("กรอกกิจกรรม วันที่ รายการ แหล่งเงิน และจำนวนเงินให้ครบ");
      return;
    }
    if (fiscalYearOf(expenseDraft.date) !== fiscalYear) {
      setError(`วันที่ต้องอยู่ในปีงบประมาณ ${fiscalYear}`);
      return;
    }
    const activity = selected.activities.find(
      (item) => item.id === expenseDraft.activityId,
    );
    const allocation = activity?.allocations.find(
      (item) => item.id === expenseDraft.allocationId,
    );
    if (!allocation) {
      setError("กิจกรรมนี้ยังไม่ได้กำหนดแหล่งเงินที่เลือก");
      return;
    }
    if (allocation.category && allocation.category !== expenseDraft.category) {
      setError("ประเภทเงินของกิจกรรมไม่ตรงกับรายการนี้");
      return;
    }
    if (
      activity!.allocations.some(
        (item) =>
          item.id !== allocation.id && item.category === expenseDraft.category,
      )
    ) {
      setError(
        "กิจกรรมนี้ใช้ประเภทเงินดังกล่าวอยู่แล้ว กรุณาเลือกแหล่งเงินที่ตรงกัน",
      );
      return;
    }
    const used = expenseFor(selected.id)
      .filter(
        (item) =>
          item.id !== editingExpenseId &&
          item.id.startsWith(projectExpenseId(selected.id, activity!.id)) &&
          item.category === expenseDraft.category,
      )
      .reduce((sum, item) => sum + item.amount, 0);
    if (used + amount > allocation.budget) {
      setError("ยอดจ่ายเกินวงเงินที่ตั้งไว้สำหรับแหล่งนี้");
      return;
    }
    const balance = reportBalance(expenseDraft.date, expenseDraft.category, expenseDraft.account);
    const previous = editingExpenseId ? expenseFor(selected.id).find((item) => item.id === editingExpenseId) : undefined;
    const effectiveBalance = balance === undefined ? undefined : balance + (previous?.account === expenseDraft.account && previous.date === expenseDraft.date ? previous.amount : 0);
    if (effectiveBalance === undefined || amount > effectiveBalance) {
      setError("ไม่พบแหล่งเงินหรือยอดคงเหลือในรายงานไม่พอจ่าย");
      return;
    }
    const pendingFile = expenseDraft.attachment?.pendingFile;
    const entry: PreviewExpense = {
      ...expenseDraft,
      account: expenseDraft.account as "cash" | "bank" | "government",
      id: editingExpenseId || `${projectExpenseId(selected.id, expenseDraft.activityId)}${newId().slice(0, 8)}`,
      description: expenseDraft.description.trim(),
      amount,
      note: `กิจกรรม: ${selected.activities.find((item) => item.id === expenseDraft.activityId)?.name || ""} · ${expenseDraft.description.trim()}`,
      attachment: pendingFile ? previous?.attachment : expenseDraft.attachment,
    };
    const nextExpenses = editingExpenseId ? expenseFor(selected.id).map((item) => item.id === editingExpenseId ? entry : item) : [...expenseFor(selected.id), entry];
    setSaving(true);
    let firstSaved = false;
    let uploadedAttachment: ProjectAttachment | undefined;
    try {
      if (demo) updateDemoExpense(previous, entry);
      const saved = demo ? selected : await saveProjectExpense(user!, selected, entry, viewAsUid);
      firstSaved = true;
      setProjects((current) => current.map((item) => item.id === saved.id ? saved : item));
      setExpenses((current) => [...current.filter((item) => !item.id.startsWith(`pexp_${selected.id}_`)), ...nextExpenses]);
      if (pendingFile && !demo && user) {
        uploadedAttachment = await uploadProjectAttachment(user, selected.id, entry.id, pendingFile, viewAsUid);
        const withAttachment = nextExpenses.map((item) => item.id === entry.id ? { ...item, attachment: uploadedAttachment } : item);
        const savedWithAttachment = await saveProjectExpense(user, saved, { ...entry, attachment: uploadedAttachment }, viewAsUid);
        uploadedAttachment = undefined;
        setProjects((current) => current.map((item) => item.id === savedWithAttachment.id ? savedWithAttachment : item));
        setExpenses((current) => [...current.filter((item) => !item.id.startsWith(`pexp_${selected.id}_`)), ...withAttachment]);
      } else if (pendingFile && demo) {
        const withAttachment = nextExpenses.map((item) => item.id === entry.id ? { ...item, attachment: expenseDraft.attachment } : item);
        setExpenses((current) => [...current.filter((item) => !item.id.startsWith(`pexp_${selected.id}_`)), ...withAttachment]);
      }
      if (!demo && user && previous?.attachment?.file && previous.attachment.file !== (pendingFile ? undefined : entry.attachment?.file)) {
        void deleteProjectAttachment(user, selected.id, previous.id, previous.attachment, viewAsUid).catch(() => {});
      }
      setExpenseDraft(null);
      setEditingExpenseId(null);
      setError("");
      window.dispatchEvent(new Event("finance-report-changed"));
      window.dispatchEvent(new Event("project-expenses-changed"));
    } catch (cause) {
      if (uploadedAttachment && user) void deleteProjectAttachment(user, selected.id, entry.id, uploadedAttachment, viewAsUid).catch(() => {});
      setError(firstSaved ? "บันทึกค่าใช้จ่ายแล้ว แต่แนบไฟล์ไม่สำเร็จ กรุณาแก้ไขรายการเพื่อลองใหม่" : saveError(cause));
      if (firstSaved) { setExpenseDraft(null); setEditingExpenseId(null); window.dispatchEvent(new Event("finance-report-changed")); window.dispatchEvent(new Event("project-expenses-changed")); }
    } finally { setSaving(false); }
  };
  const attachExpenseFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("ไฟล์แนบต้องไม่เกิน 10 MB"); return; }
    if (!/\.(pdf|png|jpe?g|webp|docx?|xlsx?)$/i.test(file.name)) { setError("รองรับ PDF รูปภาพ Word และ Excel เท่านั้น"); return; }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านไฟล์แนบไม่สำเร็จ"));
        reader.readAsDataURL(file);
      });
      setExpenseDraft((current) => current ? { ...current, attachment: { name: file.name, dataUrl, pendingFile: file } } : null);
      setError("");
    } catch { setError("อ่านไฟล์แนบไม่สำเร็จ"); }
  };
  const removeExpense = async (entry: PreviewExpense) => {
    if (!selected || !window.confirm("ลบรายการค่าใช้จ่ายนี้?")) return;
    setSaving(true);
    try {
      if (demo) updateDemoExpense(entry);
      const saved = demo ? selected : await removeProjectExpense(user!, selected, entry.id, viewAsUid);
      setProjects((current) => current.map((item) => item.id === saved.id ? saved : item));
      setExpenses((current) => current.filter((item) => item.id !== entry.id));
      window.dispatchEvent(new Event("finance-report-changed"));
      window.dispatchEvent(new Event("project-expenses-changed"));
      if (!demo && user && entry.attachment?.file) void deleteProjectAttachment(user, selected.id, entry.id, entry.attachment, viewAsUid).catch(() => {});
      setError("");
    } catch (cause) { setError(saveError(cause)); }
    finally { setSaving(false); }
  };
  const openExpenseAttachment = async (entry: PreviewExpense) => {
    if (!selected || !entry.attachment) return;
    try {
      if (entry.attachment.dataUrl) {
        const link = document.createElement("a"); link.href = entry.attachment.dataUrl; link.download = entry.attachment.name; link.click();
      } else if (user) await downloadProjectAttachment(user, selected.id, entry.id, entry.attachment, viewAsUid);
    } catch { setError("ดาวน์โหลดเอกสารแนบไม่สำเร็จ"); }
  };

  if (loading) return null;

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      {error && (
        <p
          role="alert"
          className={`${draft || expenseDraft || importPreview ? "fixed left-1/2 top-4 z-[70] w-[min(95vw,40rem)] -translate-x-1/2 shadow-xl" : ""} rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200`}
        >
          {error}
        </p>
      )}
      {selected ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setSelectedId("")}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600"
          >
            <ArrowLeft size={16} />
            กลับรายการโครงการ
          </button>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-sm text-blue-600">
                  {selected.department || "ไม่ระบุฝ่าย"}
                </p>
                <h3 className="mt-1 text-xl font-bold">{selected.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  ผู้รับผิดชอบ: {selected.owner || "ยังไม่ระบุ"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEditor(selected)}
                  className={`${button} border border-slate-200 dark:border-slate-700`}
                >
                  <Pencil size={16} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => void removeProject(selected)}
                  className={`${button} border border-rose-200 text-rose-600 dark:border-rose-900`}
                >
                  <Trash2 size={16} />
                  ลบ
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["วงเงิน", projectBudget(selected)],
                ["ใช้จ่ายแล้ว", spent(selected.id)],
                ["คงเหลือตามแผน", projectBudget(selected) - spent(selected.id)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"
                >
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {money(Number(value))} บาท
                  </p>
                </div>
              ))}
            </div>
          </section>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">กิจกรรมและแหล่งเงิน</h4>
                <button
                  type="button"
                  onClick={() => openEditor(selected)}
                  className="text-sm font-semibold text-blue-600"
                >
                  + เพิ่มกิจกรรม
                </button>
              </div>
              {selected.activities.length ? (
                <div className="mt-3 space-y-3">
                  {selected.activities.map((activity) => (
                    <ActivityBalanceCard
                      key={activity.id}
                      activity={activity}
                      spentForSource={(category) =>
                        expenseFor(selected.id)
                          .filter(
                            (entry) =>
                              entry.id.startsWith(
                                projectExpenseId(selected.id, activity.id),
                              ) && entry.category === category,
                          )
                          .reduce((sum, entry) => sum + entry.amount, 0)
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">ยังไม่มีกิจกรรม</p>
              )}
            </section>
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold">ค่าใช้จ่ายรายกิจกรรม</h4>
                  <p className="text-sm text-slate-500">บันทึกแล้วเชื่อมทะเบียนรายจ่ายและรายงานเงินคงเหลือประจำวัน</p>
                </div>
                <button
                  type="button"
                  disabled={!firstFundedActivity || saving}
                  onClick={() => {
                    setEditingExpenseId(null);
                    setExpenseDraft({
                      activityId: firstFundedActivity!.id,
                      date:
                        fiscalYear === currentFiscalYear()
                          ? todayIso()
                          : [...yearReports].sort((a, b) =>
                              b.date.localeCompare(a.date),
                            )[0]?.date || firstDayOfFiscalYear(fiscalYear),
                      allocationId: firstFundedActivity!.allocations[0].id,
                      category: firstFundedActivity!.allocations[0].category,
                      description: "",
                      amount: "",
                      documentNo: "",
                      account: "",
                    });
                  }}
                  className={`${button} bg-blue-600 text-white disabled:opacity-40`}
                >
                  <Plus size={16} />
                  เพิ่มค่าใช้จ่าย
                </button>
              </div>
              {expenseFor(selected.id).length ? (
                expenseFor(selected.id).map((entry) => (
                  <div
                    key={entry.id}
                    className="mt-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {entry.date}
                      </span>
                      <strong className="shrink-0 tabular-nums text-rose-600 dark:text-rose-400">
                        − {money(entry.amount)} บาท
                      </strong>
                    </div>
                    <p className="mt-2 font-semibold">
                      {
                        selected.activities.find((activity) =>
                          entry.id.startsWith(
                            projectExpenseId(selected.id, activity.id),
                          ),
                        )?.name
                      }{" "}
                      · {entry.description}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.category} · {entry.account === "cash" ? "เงินสด" : entry.account === "bank" ? "เงินฝากธนาคาร" : entry.account === "government" ? "เงินฝากส่วนราชการผู้เบิก" : "ยังไม่เชื่อมทะเบียนรายจ่าย · กดแก้ไขเพื่อเลือกช่องทาง"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                      {entry.attachment && <button type="button" onClick={() => void openExpenseAttachment(entry)} className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-blue-600"><Paperclip size={14}/><span className="max-w-44 truncate">{entry.attachment.name}</span></button>}
                      <div className="ml-auto flex gap-2">
                        <button type="button" onClick={() => { setEditingExpenseId(entry.id); setExpenseDraft({ activityId: entry.activityId, allocationId: entry.allocationId, date: entry.date, category: entry.category, account: entry.account || "", description: entry.description, amount: money(entry.amount), documentNo: entry.documentNo, attachment: entry.attachment }); setError(""); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-slate-700"><Pencil size={14}/>แก้ไข</button>
                        <button type="button" disabled={saving} onClick={() => void removeExpense(entry)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-40 dark:border-rose-900"><Trash2 size={14}/>ลบ</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="mt-5 text-center text-sm text-slate-500">
                  ยังไม่มีค่าใช้จ่าย
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">รายการโครงการ</h2><p className="text-sm text-slate-500">{yearProjects.length} โครงการในปีงบประมาณ {fiscalYear}</p></div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void readFile(event.target.files?.[0])}/>
              <button type="button" onClick={() => fileRef.current?.click()} className={`${button} border border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300`}><FileSpreadsheet size={17}/>นำเข้า Excel</button>
              <button type="button" data-tour="project-create" onClick={() => openEditor()} className={`${button} bg-blue-600 text-white`}><Plus size={17}/>เพิ่มโครงการ</button>
            </div>
          </div>
          <section data-tour="project-summary" aria-label="สรุปงบโครงการ" className="grid gap-3 sm:grid-cols-3">
            {[["วงเงินตามแผน", plannedTotal, "border-blue-500 dark:border-t-blue-500", "text-blue-600 dark:text-blue-300"], ["ใช้จ่ายแล้ว", spentTotal, "border-rose-400 dark:border-t-rose-400", "text-rose-600 dark:text-rose-300"], ["คงเหลือตามแผน", plannedTotal - spentTotal, "border-emerald-400 dark:border-t-emerald-400", "text-emerald-700 dark:text-emerald-300"]].map(([label, value, border, color]) => <div key={label} className={`min-w-0 rounded-2xl border border-slate-200 border-t-4 ${border} bg-white p-4 dark:border-slate-800 dark:bg-slate-900`}><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${color}`}>{money(Number(value))} <span className="text-sm font-medium">บาท</span></p></div>)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-1"><h3 className="font-bold">ใช้จ่ายจากประเภทเงิน</h3><span className="text-xs text-slate-500">รวมจากรายการค่าใช้จ่ายของทุกโครงการ</span></div>
            {spentByCategory.length ? <div className="mt-3 grid gap-2 lg:grid-cols-2">{spentByCategory.map(([category, total]) => <div key={category} className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800"><div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate" title={category}>{category}</span><strong className="shrink-0 tabular-nums text-rose-600 dark:text-rose-300">{money(total)} บาท</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-500" style={{ width: `${spentTotal ? total / spentTotal * 100 : 0}%` }}/></div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการค่าใช้จ่าย</p>}
          </section>
          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
            <select
              aria-label="เลือกฝ่าย"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
            >
              <option>ทั้งหมด</option>
              {departments.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"><Search size={18} className="shrink-0 text-slate-400"/><input aria-label="ค้นหาโครงการ" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาโครงการหรือผู้รับผิดชอบ" className="w-full min-w-0 bg-transparent py-2.5 outline-none"/></label>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {visible.length ? (
              visible.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedId(project.id)}
                  className="grid w-full gap-2 border-b border-slate-100 p-4 text-left hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/30 sm:grid-cols-[1fr_8rem_9rem]"
                >
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {project.department || "ไม่ระบุฝ่าย"} ·{" "}
                      {project.owner || "ยังไม่ระบุผู้รับผิดชอบ"}
                    </p>
                  </div>
                  <span className="text-sm text-slate-500">
                    {project.activities.length} กิจกรรม
                  </span>
                  <strong className="tabular-nums text-blue-700 dark:text-blue-300 sm:text-right">
                    {money(projectBudget(project))} บาท
                  </strong>
                </button>
              ))
            ) : (
              <p className="p-10 text-center text-slate-500">
                {yearProjects.length
                  ? "ไม่พบโครงการ"
                  : "ยังไม่มีโครงการ เพิ่มเองหรือนำเข้า Excel ได้เลย"}
              </p>
            )}
          </section>
        </>
      )}
      {draft && (
        <ProjectEditor
          draft={draft}
          categories={categories}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={saveDraft}
          demo={demo}
          saving={saving}
          isEditing={projects.some((item) => item.id === draft.id)}
          hasExpense={(activityId) =>
            expenses.some((entry) =>
              entry.id.startsWith(projectExpenseId(draft.id, activityId)),
            )
          }
        />
      )}
      {importPreview && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/60 sm:place-items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="ตรวจรายการก่อนนำเข้า"
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900 sm:rounded-3xl sm:p-7"
          >
            <h3 className="text-xl font-bold">ตรวจโครงการก่อนนำเข้า</h3>
            <p className="mt-2 text-sm text-slate-500">
              พบ {importPreview.length} โครงการ · ชื่อซ้ำในฝ่ายเดียวกันจะข้าม ·
              เลือกแหล่งเงินจริงภายหลัง
            </p>
            <div className="mt-4 max-h-[50dvh] divide-y overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {importPreview.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3 p-3 text-sm"
                >
                  <span>
                    {item.name}
                    <small className="block text-slate-500">
                      {item.department}
                    </small>
                  </span>
                  <strong className="tabular-nums">
                    {money(projectBudget(item))}
                  </strong>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className={`${button} border border-slate-200`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void importProjects()}
                className={`${button} bg-blue-600 text-white disabled:opacity-40`}
              >
                {demo ? "นำเข้าในตัวอย่าง" : "นำเข้าโครงการ"}
              </button>
            </div>
          </section>
        </div>
      )}
      {expenseDraft && selected && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/60 sm:place-items-center sm:p-4">
          <section
            data-tour="tour-active-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingExpenseId ? "แก้ไขค่าใช้จ่าย" : "เพิ่มค่าใช้จ่าย"}
            className="max-h-[100dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-slate-900 sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-3xl sm:p-6"
          >
            <h3 className="text-xl font-bold">{editingExpenseId ? "แก้ไขค่าใช้จ่ายกิจกรรม" : "เพิ่มค่าใช้จ่ายกิจกรรม"}</h3>
            <div className="mt-4 grid gap-x-5 gap-y-3 md:grid-cols-2">
              <label className="block min-w-0 md:col-span-2">
                กิจกรรม
                <select
                  value={expenseDraft.activityId}
                  disabled={!!editingExpenseId}
                  onChange={(event) =>
                    setExpenseDraft({
                      ...expenseDraft,
                      activityId: event.target.value,
                      allocationId:
                        selected.activities.find(
                          (activity) => activity.id === event.target.value,
                        )?.allocations[0]?.id || "",
                      category:
                        selected.activities.find(
                          (activity) => activity.id === event.target.value,
                        )?.allocations[0]?.category || "",
                    })
                  }
                  className={input}
                >
                  {selected.activities
                    .filter((activity) => activity.allocations.length)
                    .map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block min-w-0">
                วันที่
                <ThaiDatePicker
                  value={expenseDraft.date}
                  onChange={(date) =>
                    setExpenseDraft({ ...expenseDraft, date })
                  }
                />
              </label>
              <label className="block min-w-0">
                จำนวนเงิน
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="จำนวนเงิน"
                  value={expenseDraft.amount}
                  onChange={(event) =>
                    setExpenseDraft({
                      ...expenseDraft,
                      amount: formatMoneyInput(event.target.value),
                    })
                  }
                  className={input}
                />
              </label>
              <label className="block min-w-0">
                จ่ายจากแหล่งเงิน
                <select
                  value={expenseDraft.allocationId}
                  onChange={(event) => {
                    const allocation = expenseActivity?.allocations.find(
                      (item) => item.id === event.target.value,
                    );
                    setExpenseDraft({
                      ...expenseDraft,
                      allocationId: event.target.value,
                      category: allocation?.category || "",
                    });
                  }}
                  className={input}
                >
                  {expenseActivity?.allocations.map((allocation) => (
                    <option key={allocation.id} value={allocation.id}>
                      {allocation.category ||
                        allocation.sourceLabel ||
                        "ยังไม่เลือกประเภทเงิน"}{" "}
                      · {money(allocation.budget)} บาท
                    </option>
                  ))}
                </select>
              </label>
              {expenseAllocation && !expenseAllocation.category && (
                <label className="block min-w-0">
                  ประเภทเงินในรายงาน
                  <select
                    value={expenseDraft.category}
                    onChange={(event) =>
                      setExpenseDraft({
                        ...expenseDraft,
                        category: event.target.value,
                      })
                    }
                    className={input}
                  >
                    <option value="">เลือกประเภทเงิน</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block min-w-0">
                จ่ายจากช่องทาง
                <select value={expenseDraft.account} onChange={(event) => setExpenseDraft({ ...expenseDraft, account: event.target.value as ExpenseDraft["account"] })} className={input}>
                  <option value="">เลือกช่องทางที่หักยอด</option>
                  <option value="cash">เงินสด</option>
                  <option value="bank">เงินฝากธนาคาร</option>
                  <option value="government">เงินฝากส่วนราชการผู้เบิก</option>
                </select>
              </label>
              <label className="block min-w-0">
                รายการค่าใช้จ่าย
                <input
                  value={expenseDraft.description}
                  onChange={(event) =>
                    setExpenseDraft({
                      ...expenseDraft,
                      description: event.target.value,
                    })
                  }
                  className={input}
                />
              </label>
              <label className="block min-w-0">
                เลขที่เอกสาร (ถ้ามี)
                <input
                  value={expenseDraft.documentNo}
                  onChange={(event) =>
                    setExpenseDraft({
                      ...expenseDraft,
                      documentNo: event.target.value,
                    })
                  }
                  className={input}
                />
              </label>
              <div className="min-w-0 md:col-span-2">
                <label className="block text-sm font-semibold">เอกสารแนบ (ถ้ามี)
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(event) => { void attachExpenseFile(event.target.files?.[0]); event.target.value = ""; }} className={`${input} text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-200`}/>
                </label>
                {expenseDraft.attachment && <div className="mt-2 flex items-center gap-2 text-sm"><Paperclip size={16}/><span className="min-w-0 truncate">{expenseDraft.attachment.name}</span><button type="button" onClick={() => setExpenseDraft({ ...expenseDraft, attachment: undefined })} className="shrink-0 font-semibold text-rose-600">นำออก</button></div>}
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200 sm:p-4">
              <p className="text-xs">
                ยอดก่อนรายการนี้:{" "}
                {currentReportBalance === undefined
                  ? "ไม่มีข้อมูล"
                  : `${money(currentReportBalance)} บาท`}
              </p>
              <p className="mt-2 border-t border-blue-200 pt-2 dark:border-blue-800">
                ยอดคงเหลือในรายงานหลังหัก (ประมาณการ):{" "}
                <strong
                  className={`tabular-nums text-lg ${projectedBalance !== undefined && projectedBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-700 dark:text-blue-200"}`}
                >
                  {projectedBalance === undefined
                    ? "ไม่มีข้อมูล"
                    : `${money(projectedBalance)} บาท`}
                </strong>
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setExpenseDraft(null); setEditingExpenseId(null); setError(""); }}
                className={`${button} border border-slate-200`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void saveExpense()}
                className={`${button} bg-blue-600 text-white disabled:opacity-40`}
              >
                {saving ? "กำลังบันทึก..." : editingExpenseId ? "บันทึกการแก้ไข" : demo ? "เพิ่มในตัวอย่าง" : "บันทึกค่าใช้จ่าย"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


