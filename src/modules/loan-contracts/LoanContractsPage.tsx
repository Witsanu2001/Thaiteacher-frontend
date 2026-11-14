import { useEffect, useState } from "react";
import axios from "axios";
import type { User } from "firebase/auth";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import {
  activeDataVersion,
  scopedStorage,
} from "../../shared/funtion/scopedStorage";
import { thaiDate } from "../../shared/funtion/thaiDate";
import {
  approveLoanContract,
  deleteLoanAttachment,
  deleteLoanContract,
  loadLoanContracts,
  readLoanAttachment,
  saveLoanContract,
  uploadLoanAttachment,
  type VersionedLoan,
} from "../../config/services/loan-contracts.service";
import { saveDemoReports } from "../../features/auth/demoFinanceStore";
import LoanContractPreview from "./LoanContractPreview";
import LoanSourcePicker from "./LoanSourcePicker";
import LoanContractList from "./LoanContractList";
import LoanAttachments from "./LoanAttachments";
import LoanRepayments from "./LoanRepayments";
import type { DailyReport } from "../../shared/funtion/types";
import { thaiProvinces } from "./thaiProvinces";
import {
  emptyExpense,
  loanTotal,
  newContract,
  thaiBahtText,
  toAmount,
  type LoanAttachment,
  type LoanContract,
} from "./loanContract";

const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const label =
  "grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const readContracts = (key: string): VersionedLoan[] => {
  try {
    const value: unknown = JSON.parse(scopedStorage.getItem(key) || "[]");
    return Array.isArray(value) ? (value as VersionedLoan[]) : [];
  } catch {
    return [];
  }
};
type RememberedLocation = { affiliation: string; province: string };
const readRememberedLocation = (key: string): RememberedLocation | null => {
  try {
    const saved: unknown = JSON.parse(scopedStorage.getItem(key) || "null");
    if (
      saved &&
      typeof saved === "object" &&
      "affiliation" in saved &&
      "province" in saved &&
      typeof saved.affiliation === "string" &&
      typeof saved.province === "string"
    ) {
      return { affiliation: saved.affiliation, province: saved.province };
    }
  } catch {
    /* Missing or invalid preferences use empty fields. */
  }
  return null;
};
function TextField({
  title,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={label}>
      {title}
      <input
        className={field}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function DateField({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={label}>
      <span>{title}</span>
      <span className="flex flex-wrap items-center gap-2">
        <ThaiDatePicker value={value} onChange={onChange} />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ล้างวันที่
          </button>
        )}
      </span>
    </div>
  );
}

export default function LoanContractsPage({
  school,
  reports,
  user,
  viewAsUid,
  demo,
  tourActive = false,
}: {
  school: string;
  reports: DailyReport[];
  user?: User;
  viewAsUid?: string;
  demo: boolean;
  tourActive?: boolean;
}) {
  const key = `school-loan-contracts:${school}`;
  const rememberKey = `school-loan-contract-location:${school}`;
  const [contracts, setContracts] = useState<VersionedLoan[]>(() =>
    demo ? readContracts(key) : [],
  );
  const tourContract: LoanContract = { ...newContract(school), id: "tour-loan", number: "ย.001/2570", borrower: "ครูตัวอย่าง", position: "ครู", purpose: "จัดกิจกรรมนักเรียน", borrowFrom: "เงินอุดหนุนค่าใช้จ่ายรายหัว", sourceCategory: "เงินอุดหนุนค่าใช้จ่ายรายหัว", sourceAccount: "bank", expenses: [{ id: "tour-expense", description: "จัดกิจกรรมนักเรียน", amount: "2000" }] };
  const [draft, setDraft] = useState<LoanContract>(
    () =>
      readContracts(key)[0] || {
        ...newContract(school),
        ...readRememberedLocation(rememberKey),
      },
  );
  const [view, setView] = useState<"list" | "form">("list");
  const [section, setSection] = useState<
    "contract" | "repayment" | "attachments"
  >("contract");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingFront, setPendingFront] = useState<File | null>(null);
  const [pendingBack, setPendingBack] = useState<File[]>([]);
  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    },
    [imagePreview],
  );
  useEffect(() => {
    if (demo) return;
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const remote = await loadLoanContracts(user, viewAsUid);
        if (!active) return;
        if (!viewAsUid) {
          const migrationKey = `loan-contracts-migrated:${user.uid}:${activeDataVersion()}:${key}`;
          if (localStorage.getItem(migrationKey) === "1") {
            setContracts(remote);
            return;
          }
          const legacy = readContracts(key);
          const missing = legacy.filter(
            (item) => !remote.some((stored) => stored.id === item.id),
          );
          if (missing.length) {
            const migrated: VersionedLoan[] = [];
            for (const item of missing)
              migrated.push(
                await saveLoanContract(
                  user,
                  { ...item, version: undefined },
                  viewAsUid,
                ),
              );
            if (!active) return;
            setContracts([...migrated, ...remote]);
            localStorage.setItem(migrationKey, "1");
            setMessage(`ย้ายสัญญาเดิม ${migrated.length} ฉบับเข้าระบบแล้ว`);
            return;
          }
          localStorage.setItem(migrationKey, "1");
        }
        setContracts(remote);
      } catch {
        if (active) {
          setLoadFailed(true);
          setMessage("โหลดสัญญายืมเงินจากระบบไม่สำเร็จ กรุณาลองใหม่");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [demo, user, viewAsUid, key]);
  const total = loanTotal(draft);
  const storeLocation = (
    value: Pick<LoanContract, "affiliation" | "province">,
  ) => {
    try {
      scopedStorage.setItem(
        rememberKey,
        JSON.stringify({
          affiliation: value.affiliation,
          province: value.province,
        }),
      );
      return true;
    } catch {
      setMessage("จดจำสังกัดและจังหวัดไม่สำเร็จ กรุณาลองอีกครั้ง");
      return false;
    }
  };
  const rememberWhenPrinting = () => {
    if (draft.affiliation.trim() || draft.province.trim()) storeLocation(draft);
  };
  const update = <K extends keyof LoanContract>(
    name: K,
    value: LoanContract[K],
  ) => {
    setDraft((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setMessage("");
  };
  const updateSource = (change: Partial<LoanContract>) => {
    setDraft((current) => ({ ...current, ...change }));
    setDirty(true);
    setMessage("");
  };
  const patchExpense = (
    id: string,
    fieldName: "description" | "amount",
    value: string,
  ) =>
    update(
      "expenses",
      draft.expenses.map((item) =>
        item.id === id ? { ...item, [fieldName]: value } : item,
      ),
    );
  const save = async () => {
    const invalidAmount = [...draft.expenses, ...(draft.repayments || [])].some(
      (item) =>
        item.amount &&
        (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 0),
    );
    if (invalidAmount) {
      setMessage("จำนวนเงินต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    if (
      (draft.repayments || []).reduce(
        (sum, item) => sum + toAmount(item.amount),
        0,
      ) > total
    ) {
      setMessage("ยอดส่งใช้รวมต้องไม่เกินยอดเงินยืม");
      return;
    }
    if (!reports.some((item) => item.date <= draft.loanDate)) {
      setMessage("กรุณาบันทึกรายงานเงินคงเหลือประจำวันก่อนทำสัญญายืมเงิน");
      return;
    }
    const sourceReport = reports.find(
      (item) =>
        item.date === draft.sourceReportDate && item.date <= draft.loanDate,
    );
    const sourceRow = sourceReport?.rows[draft.sourceRowIndex ?? -1];
    if (
      !sourceRow ||
      sourceRow.group ||
      sourceRow.name !== draft.sourceCategory ||
      !draft.sourceAccount
    ) {
      setMessage(
        "กรุณาเลือกวันที่รายงาน ประเภทเงิน และช่องทางเงินที่ยืมก่อนบันทึก",
      );
      return;
    }
    if (
      !draft.approvedAt &&
      sourceRow &&
      draft.sourceAccount &&
      total > (Number(sourceRow[draft.sourceAccount]) || 0)
    ) {
      setMessage(
        "ยอดเงินยืมสูงกว่ายอดคงเหลือของแหล่งเงินที่เลือก กรุณาตรวจสอบยอดรายวัน",
      );
      return;
    }
    const savedRepaymentCount =
      contracts.find((item) => item.id === draft.id)?.repayments?.length || 0;
    if (
      draft.approvedAt &&
      (draft.repayments || [])
        .slice(savedRepaymentCount)
        .some(
          (item) =>
            !item.date ||
            !reports.some((report) => report.date === item.date) ||
            toAmount(item.amount) <= 0,
        )
    ) {
      setMessage(
        "รายการส่งใช้ต้องระบุวันที่ที่มีรายงานเงินคงเหลือ และจำนวนเงินมากกว่า 0",
      );
      return;
    }
    setSaving(true);
    const uploaded: LoanAttachment[] = [];
    try {
      if (!demo && user) {
        if (pendingFront)
          uploaded.push(
            await uploadLoanAttachment(
              user,
              draft.id,
              "front",
              pendingFront,
              viewAsUid,
            ),
          );
        for (const file of pendingBack)
          uploaded.push(
            await uploadLoanAttachment(user, draft.id, "back", file, viewAsUid),
          );
      }
      const frontAttachment =
        uploaded.find((item) => item.side === "front") || draft.frontAttachment;
      const backAttachments = [
        ...(draft.backAttachments || []),
        ...uploaded.filter((item) => item.side === "back"),
      ];
      const input = {
        ...draft,
        frontAttachment,
        backAttachments,
        version: contracts.find((item) => item.id === draft.id)?.version,
        updatedAt: new Date().toISOString(),
      };
      const previous = contracts.find((item) => item.id === draft.id);
      if (demo && input.approvedAt && previous && input.sourceAccount) {
        const changed = new Map<string, DailyReport>();
        for (const repayment of input.repayments.slice(
          previous.repayments?.length || 0,
        )) {
          const base =
            changed.get(repayment.date) ||
            reports.find((item) => item.date === repayment.date);
          if (!base) throw new Error("missing_repayment_report");
          const rows = base.rows.map((row, index) =>
            index === input.sourceRowIndex
              ? {
                  ...row,
                  [input.sourceAccount!]:
                    Number(row[input.sourceAccount!]) +
                    toAmount(repayment.amount),
                  note: [row.note, `ส่งใช้เงินยืม ${input.number}`]
                    .filter(Boolean)
                    .join(" | "),
                }
              : row,
          );
          changed.set(repayment.date, { ...base, rows });
        }
        if (changed.size) saveDemoReports([...changed.values()]);
      }
      const saved =
        demo || !user ? input : await saveLoanContract(user, input, viewAsUid);
      const next = [saved, ...contracts.filter((item) => item.id !== saved.id)];
      if (demo) scopedStorage.setItem(key, JSON.stringify(next));
      setContracts(next);
      setDraft(saved);
      setDirty(false);
      if (!demo) {
        setPendingFront(null);
        setPendingBack([]);
      }
      const oldFiles = [
        previous?.frontAttachment,
        ...(previous?.backAttachments || []),
      ].filter((item): item is LoanAttachment => Boolean(item));
      const currentFiles = [
        saved.frontAttachment,
        ...(saved.backAttachments || []),
      ].filter((item): item is LoanAttachment => Boolean(item));
      if (user && !demo) {
        const removed = oldFiles.filter(
          (item) => !currentFiles.some((current) => current.file === item.file),
        );
        void Promise.allSettled(
          removed.map((item) =>
            deleteLoanAttachment(user, saved.id, item, viewAsUid),
          ),
        );
      }
      setMessage(
        demo && (pendingFront || pendingBack.length)
          ? "บันทึกตัวอย่างแล้ว ไฟล์แนบจะแสดงในหน้านี้เท่านั้น"
          : "บันทึกสัญญาแล้ว",
      );
      window.dispatchEvent(new Event("loan-contracts-changed"));
      if (
        saved.approvedAt &&
        (saved.repayments || []).length > (previous?.repayments || []).length
      )
        window.dispatchEvent(new Event("finance-report-changed"));
    } catch (error) {
      if (user && uploaded.length)
        void Promise.allSettled(
          uploaded.map((item) =>
            deleteLoanAttachment(user, draft.id, item, viewAsUid),
          ),
        );
      setMessage(
        axios.isAxiosError(error) && error.response?.status === 409
          ? "มีผู้แก้ไขสัญญานี้จากอีกเครื่องแล้ว กรุณาเปิดหน้านี้ใหม่ก่อนบันทึก"
          : axios.isAxiosError(error) && error.response?.status === 422
            ? "บันทึกส่งใช้ไม่ได้ กรุณาตรวจวันที่รายงาน แหล่งเงิน และรายการที่บันทึกแล้ว"
            : axios.isAxiosError(error) && error.response?.status === 503
              ? "ยังไม่พร้อมเก็บไฟล์แนบ กรุณาตรวจการตั้งค่า Firebase Storage ของ school-service"
              : "บันทึกสัญญาไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  };
  const approve = async () => {
    const stored = contracts.find((item) => item.id === draft.id);
    if (!stored || dirty || saving || stored.approvedAt) {
      setMessage("กรุณาบันทึกข้อมูลสัญญาให้เรียบร้อยก่อนอนุมัติ");
      return;
    }
    const report = reports.find((item) => item.date === stored.loanDate);
    const row = report?.rows[stored.sourceRowIndex ?? -1];
    const amount = loanTotal(stored);
    if (
      !report ||
      !row ||
      row.group ||
      row.name !== stored.sourceCategory ||
      !stored.sourceAccount ||
      !stored.borrower.trim() ||
      amount <= 0
    ) {
      setMessage(
        "กรุณาสร้างรายงานเงินคงเหลือในวันทำสัญญา และตรวจผู้ยืม แหล่งเงิน และยอดยืมก่อนอนุมัติ",
      );
      return;
    }
    if ((Number(row[stored.sourceAccount]) || 0) < amount) {
      setMessage("ยอดคงเหลือในวันที่ทำสัญญาไม่พอสำหรับอนุมัติเงินยืม");
      return;
    }
    if (stored.repayments?.length) {
      setMessage(
        "กรุณาล้างรายการส่งใช้เดิมก่อนอนุมัติ แล้วบันทึกรายการส่งใช้อีกครั้งหลังอนุมัติ",
      );
      return;
    }
    if (
      !window.confirm(
        `อนุมัติสัญญา ${stored.number || "ฉบับนี้"} และหัก ${amount.toLocaleString("th-TH")} บาทจากรายงานวันที่ ${thaiDate(stored.loanDate)}?`,
      )
    )
      return;
    setSaving(true);
    try {
      let approved: VersionedLoan;
      if (demo) {
        approved = { ...stored, approvedAt: new Date().toISOString() };
        const nextRows = report.rows.map((item, index) =>
          index === stored.sourceRowIndex
            ? {
                ...item,
                [stored.sourceAccount!]:
                  Number(item[stored.sourceAccount!]) - amount,
                note: [item.note, stored.purpose].filter(Boolean).join(" | "),
              }
            : item,
        );
        saveDemoReports([{ ...report, rows: nextRows }]);
        scopedStorage.setItem(
          key,
          JSON.stringify([
            approved,
            ...contracts.filter((item) => item.id !== approved.id),
          ]),
        );
      } else if (user)
        approved = await approveLoanContract(user, stored, viewAsUid);
      else throw new Error("not_authenticated");
      setContracts([
        approved,
        ...contracts.filter((item) => item.id !== approved.id),
      ]);
      setDraft(approved);
      setMessage(
        "อนุมัติแล้ว ยอดถูกหักจากรายงานรายวัน และบันทึกรายจ่ายในทะเบียน",
      );
      window.dispatchEvent(new Event("loan-contracts-changed"));
      window.dispatchEvent(new Event("finance-report-changed"));
    } catch (error) {
      setMessage(
        axios.isAxiosError(error) && error.response?.status === 409
          ? "สัญญาถูกแก้ไขจากอีกเครื่องแล้ว กรุณาโหลดหน้าใหม่"
          : "อนุมัติไม่สำเร็จ ตรวจว่ามีรายงานในวันทำสัญญาและยอดเงินเพียงพอ",
      );
    } finally {
      setSaving(false);
    }
  };
  const select = (id: string) => {
    if (
      dirty &&
      !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปลี่ยนสัญญาหรือไม่?")
    )
      return;
    const selected = contracts.find((item) => item.id === id);
    if (selected) {
      setDraft(selected);
      setPendingFront(null);
      setPendingBack([]);
      setDirty(false);
      setMessage("");
      setImagePreview(null);
      setSection("contract");
      setView("form");
    }
  };
  const create = () => {
    if (
      dirty &&
      !window.confirm(
        "มีข้อมูลที่ยังไม่ได้บันทึก ต้องการสร้างสัญญาใหม่หรือไม่?",
      )
    )
      return;
    setDraft({
      ...newContract(school),
      ...readRememberedLocation(rememberKey),
    });
    setPendingFront(null);
    setPendingBack([]);
    setDirty(false);
    setMessage("");
    setImagePreview(null);
    setSection("contract");
    setView("form");
  };
  useEffect(() => {
    const showStep = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; title: string }>).detail;
      if (detail?.path !== "/finance/loan-contracts") return;
      if (detail.title === "ตัวอย่างสัญญา") { setView("list"); return; }
      setDraft({ ...tourContract, approvedAt: detail.title === "รายการส่งใช้เงินยืม" ? new Date().toISOString() : undefined });
      setView("form");
      setSection(detail.title === "รายการส่งใช้เงินยืม" ? "repayment" : detail.title === "แนบเอกสาร" ? "attachments" : "contract");
      setDirty(false);
    };
    window.addEventListener("thaiteacher:tour-step", showStep);
    return () => window.removeEventListener("thaiteacher:tour-step", showStep);
  });
  useEffect(() => {
    if (tourActive) return;
    const timer = window.setTimeout(() => { if (draft.id === "tour-loan") setView("list"); }, 0);
    return () => window.clearTimeout(timer);
  }, [tourActive, draft.id]);
  const remove = async () => {
    if (
      !contracts.some((item) => item.id === draft.id) ||
      !window.confirm("ลบสัญญาฉบับนี้ออกจากระบบ?")
    )
      return;
    const next = contracts.filter((item) => item.id !== draft.id);
    setSaving(true);
    try {
      if (demo) scopedStorage.setItem(key, JSON.stringify(next));
      else if (user)
        await deleteLoanContract(
          user,
          contracts.find((item) => item.id === draft.id)!,
          viewAsUid,
        );
      setContracts(next);
      setDraft(
        next[0] || {
          ...newContract(school),
          ...readRememberedLocation(rememberKey),
        },
      );
      setDirty(false);
      setPendingFront(null);
      setPendingBack([]);
      setMessage("ลบสัญญาแล้ว");
      setSection("contract");
      setView("list");
    } catch (error) {
      setMessage(
        axios.isAxiosError(error) && error.response?.status === 409
          ? "สัญญาถูกแก้จากอีกเครื่อง กรุณาเปิดหน้านี้ใหม่"
          : "ลบสัญญาไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };
  const backToList = () => {
    if (
      dirty &&
      !window.confirm(
        "มีข้อมูลที่ยังไม่ได้บันทึก ต้องการกลับไปรายการสัญญาหรือไม่?",
      )
    )
      return;
    setDirty(false);
    setPendingFront(null);
    setPendingBack([]);
    setPreview(false);
    setImagePreview(null);
    setMessage("");
    setSection("contract");
    setView("list");
  };
  const openSavedAttachment = async (attachment: LoanAttachment) => {
    if (!user) {
      setMessage("เปิดไฟล์แนบได้หลังเข้าสู่ระบบ");
      return;
    }
    const image = attachment.contentType.startsWith("image/");
    const tab =
      attachment.contentType === "application/pdf"
        ? window.open("", "_blank")
        : null;
    try {
      const blob = await readLoanAttachment(
        user,
        draft.id,
        attachment,
        viewAsUid,
      );
      const url = URL.createObjectURL(blob);
      if (image) {
        setImagePreview({ url, name: attachment.name });
        return;
      }
      if (tab) tab.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.name;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setMessage("เปิดเอกสารแนบไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  if (loading) return null;
  if (loadFailed)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900 dark:bg-slate-900"
      >
        <p>{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-white"
        >
          ลองใหม่
        </button>
      </div>
    );
  if (view === "list")
    return (
      <LoanContractList
        school={school}
        contracts={(tourActive || demo) && contracts.length === 0 ? [tourContract] : contracts}
        onCreate={create}
        onOpen={select}
        message={message}
      />
    );
  return (
    <div className={`space-y-5 ${tourActive ? "pb-64" : "pb-8"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 sm:p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            <ArrowLeft size={16} /> กลับรายการสัญญา
          </button>
          {dirty && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              ยังไม่บันทึก
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-tour="loan-save"
            onClick={save}
            disabled={saving || (tourActive && draft.id === "tour-loan")}
            className={`${button} bg-blue-700 text-white`}
          >
            <Save size={17} /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          {contracts.some((item) => item.id === draft.id) &&
            !draft.approvedAt && (
              <button
                type="button"
                onClick={() => void approve()}
                disabled={saving || dirty}
                className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}
              >
                <CheckCircle2 size={17} /> อนุมัติและหักยอด
              </button>
            )}
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={`${button} border border-slate-300 dark:border-slate-700`}
          >
            <FileText size={17} /> ดูแบบฟอร์ม
          </button>
          {contracts.some((item) => item.id === draft.id) &&
            !draft.approvedAt && (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className={`${button} text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950`}
              >
                <Trash2 size={16} /> ลบ
              </button>
            )}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-5">
          <div
            role="tablist"
            aria-label="ส่วนของสัญญายืมเงิน"
            className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              role="tab"
              aria-selected={section === "contract"}
              onClick={() => setSection("contract")}
              className={`${button} min-w-0 ${section === "contract" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              1 ข้อมูลสัญญา
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === "repayment"}
              disabled={!draft.approvedAt}
              title={
                !draft.approvedAt
                  ? "อนุมัติสัญญาก่อนบันทึกรายการส่งใช้"
                  : undefined
              }
              onClick={() => setSection("repayment")}
              className={`${button} min-w-0 ${section === "repayment" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              2 รายการส่งใช้เงินยืม
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === "attachments"}
              onClick={() => setSection("attachments")}
              className={`${button} min-w-0 ${section === "attachments" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
            >
              3 เอกสารแนบ
            </button>
          </div>
          {section === "contract" && (
            <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              {draft.approvedAt && (
                <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  อนุมัติแล้ว ·
                  ข้อมูลยอดยืมและแหล่งเงินถูกล็อกเพื่อให้ตรงกับรายงาน
                </p>
              )}
              <fieldset
                disabled={Boolean(draft.approvedAt)}
                className="space-y-5 disabled:opacity-75"
              >
                <div>
                  <h3 className="text-lg font-semibold">
                    ข้อมูลผู้ยืมและวัตถุประสงค์
                  </h3>
                  <p className="text-sm text-slate-500">
                    ข้อมูลนี้จะแสดงในหน้าสัญญาด้านหน้า
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div data-tour="loan-contract-number">
                    <TextField
                      title="เลขที่สัญญา"
                      value={draft.number}
                      onChange={(value) => update("number", value)}
                      placeholder="เช่น 1/2570"
                    />
                  </div>
                  <DateField
                    title="วันทำสัญญา"
                    value={draft.loanDate}
                    onChange={(value) =>
                      updateSource({
                        loanDate: value,
                        ...(draft.sourceReportDate &&
                        draft.sourceReportDate > value
                          ? {
                              sourceReportDate: "",
                              sourceCategory: "",
                              sourceRowIndex: undefined,
                              sourceAccount: undefined,
                              borrowFrom: "",
                            }
                          : {}),
                      })
                    }
                  />
                  <TextField
                    title="ยื่นต่อ"
                    value={draft.submittedTo}
                    onChange={(value) => update("submittedTo", value)}
                  />
                  <DateField
                    title="วันครบกำหนด"
                    value={draft.dueDate}
                    onChange={(value) => update("dueDate", value)}
                  />
                  <TextField
                    title="ชื่อผู้ยืม"
                    value={draft.borrower}
                    onChange={(value) => update("borrower", value)}
                  />
                  <TextField
                    title="ตำแหน่ง"
                    value={draft.position}
                    onChange={(value) => update("position", value)}
                  />
                  <TextField
                    title="สังกัด"
                    value={draft.affiliation}
                    onChange={(value) => update("affiliation", value)}
                  />
                  <label className={label}>
                    จังหวัด
                    <select
                      className={field}
                      value={draft.province}
                      onChange={(event) =>
                        update("province", event.target.value)
                      }
                    >
                      <option value="">เลือกจังหวัด</option>
                      {draft.province &&
                        !thaiProvinces.includes(draft.province) && (
                          <option value={draft.province}>
                            {draft.province}
                          </option>
                        )}
                      {thaiProvinces.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    title="ส่งใช้ภายใน (วัน)"
                    value={draft.repaymentDays}
                    onChange={(value) => update("repaymentDays", value)}
                    placeholder="จำนวนวันตามระเบียบ"
                  />
                </div>
                <LoanSourcePicker
                  contract={draft}
                  reports={reports}
                  onChange={updateSource}
                />
                <label className={label}>
                  เพื่อเป็นค่าใช้จ่ายในการ
                  <textarea
                    rows={2}
                    className={field}
                    value={draft.purpose}
                    onChange={(event) => update("purpose", event.target.value)}
                    placeholder="ระบุวัตถุประสงค์ของการยืมเงิน"
                  />
                </label>
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold">รายละเอียดค่าใช้จ่าย</h4>
                    <button
                      type="button"
                      disabled={draft.expenses.length >= 6}
                      onClick={() =>
                        update("expenses", [...draft.expenses, emptyExpense()])
                      }
                      className={`${button} text-blue-700 dark:text-blue-300`}
                    >
                      <Plus size={16} /> เพิ่มรายการ
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {draft.expenses.map((item, index) => (
                      <div
                        key={item.id}
                        className="grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60 sm:grid-cols-[1fr_150px_auto]"
                      >
                        <TextField
                          title={`รายการที่ ${index + 1}`}
                          value={item.description}
                          onChange={(value) =>
                            patchExpense(item.id, "description", value)
                          }
                        />
                        <label className={label}>
                          จำนวนเงิน
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={field}
                            value={item.amount}
                            onChange={(event) =>
                              patchExpense(
                                item.id,
                                "amount",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          aria-label={`ลบรายการที่ ${index + 1}`}
                          disabled={draft.expenses.length === 1}
                          onClick={() =>
                            update(
                              "expenses",
                              draft.expenses.filter(
                                (row) => row.id !== item.id,
                              ),
                            )
                          }
                          className="self-end rounded-lg p-3 text-rose-600 disabled:opacity-30"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      รวมเงินยืม
                    </p>
                    <strong className="text-2xl text-blue-900 dark:text-blue-100">
                      {total.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </strong>
                    <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                      {thaiBahtText(total)}
                    </p>
                  </div>
                </div>
                <TextField
                  title="จำนวนเงินตัวอักษร (เว้นว่างเพื่อใช้ค่าที่คำนวณ)"
                  value={draft.amountWords}
                  onChange={(value) => update("amountWords", value)}
                />
              </fieldset>
            </section>
          )}
          {section === "attachments" && (
            <LoanAttachments
              front={draft.frontAttachment}
              back={draft.backAttachments || []}
              pendingFront={pendingFront}
              pendingBack={pendingBack}
              onFront={(file) => {
                setPendingFront(file);
                setDirty(true);
                setMessage("");
              }}
              onBack={(files) => {
                setPendingBack((current) => [...current, ...files]);
                setDirty(true);
                setMessage("");
              }}
              onRemoveFront={() => {
                if (pendingFront) setPendingFront(null);
                else update("frontAttachment", undefined);
              }}
              onRemoveBack={(index, pending) => {
                if (pending)
                  setPendingBack((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  );
                else
                  update(
                    "backAttachments",
                    (draft.backAttachments || []).filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  );
              }}
              onOpenSaved={(attachment) => void openSavedAttachment(attachment)}
              onError={setMessage}
            />
          )}
          {section === "repayment" && draft.approvedAt && (
            <LoanRepayments
              contract={draft}
              savedCount={
                contracts.find((item) => item.id === draft.id)?.repayments
                  ?.length || 0
              }
              availableDates={reports.map((item) => item.date)}
              onChange={(repayments) => update("repayments", repayments)}
            />
          )}
        </div>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-4">
          <h3 className="font-semibold">สรุปสัญญา</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">โรงเรียน</dt>
              <dd className="text-right font-medium">{school}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">ผู้ยืม</dt>
              <dd className="text-right font-medium">
                {draft.borrower || "ยังไม่ระบุ"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">วันครบกำหนด</dt>
              <dd className="font-medium">
                {draft.dueDate ? thaiDate(draft.dueDate) : "ยังไม่ระบุ"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">แหล่งเงิน</dt>
              <dd className="text-right font-medium">
                {draft.borrowFrom || "ยังไม่เลือก"}
              </dd>
            </div>
            {draft.sourceReportDate && (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">ยอด ณ วันที่</dt>
                <dd className="font-medium">
                  {thaiDate(draft.sourceReportDate)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">ยอดยืม</dt>
              <dd className="font-semibold">
                {total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                บาท
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={`${button} mt-5 w-full bg-blue-700 text-white`}
          >
            <FileText size={17} /> ดูเอกสาร 2 หน้า
          </button>
        </aside>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"
        >
          {message}
        </p>
      )}
      {preview &&
        createPortal(
          <LoanContractPreview
            contract={draft}
            school={school}
            onPrint={rememberWhenPrinting}
            onClose={() => setPreview(false)}
          />,
          document.body,
        )}
      {imagePreview &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`รูปภาพ ${imagePreview.name}`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"
            onClick={() => setImagePreview(null)}
          >
            <div
              className="w-full max-w-4xl rounded-2xl bg-white p-4 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">
                  {imagePreview.name}
                </h3>
                <button
                  type="button"
                  aria-label="ปิดรูปภาพ"
                  onClick={() => setImagePreview(null)}
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
              <a
                href={imagePreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <img
                  src={imagePreview.url}
                  alt={imagePreview.name}
                  className="mx-auto max-h-[70vh] max-w-full object-contain"
                />
              </a>
              <a
                href={imagePreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-300"
              >
                เปิดรูปภาพในแท็บใหม่
              </a>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
