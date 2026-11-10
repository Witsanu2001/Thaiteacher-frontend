import { scopedStorage } from '../../shared/funtion/scopedStorage';
import { useMemo, useState } from "react";
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

import type { CashbookEntry as Entry } from '../../shared/funtion/types';
import { money } from '../../shared/funtion/money';
import AnimatedNumber from "../../shared/components/AnimatedNumber";
type Draft = Omit<Entry, "id" | "amount" | "attachment"> & {
  amount: string;
  attachment?: Entry["attachment"];
};
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const key = (school: string) => `school-cashbook:${school}`;
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
}: {
  school: string;
  categories: string[];
  fiscalYear: number;
}) {
  const options = categories.length ? categories : ["เงินรายได้สถานศึกษา"];
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = JSON.parse(scopedStorage.getItem(key(school)) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [category, setCategory] = useState(options[0]);
  const [kindFilter, setKindFilter] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => empty(options[0]));
  const [error, setError] = useState("");
  const [openingBalances, setOpeningBalances] = useState<
    Record<string, number>
  >(() => {
    try {
      return JSON.parse(scopedStorage.getItem(`${key(school)}:opening`) || "{}");
    } catch {
      return {};
    }
  });
  const [editingOpening, setEditingOpening] = useState(false);
  const openingKey=`${fiscalYear}:${category}`;
  const opening = openingBalances[openingKey] ?? (fiscalYear===currentFiscalYear()?openingBalances[category]:undefined) ?? 0;
  const categoryEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.category === category && fiscalYearOf(entry.date)===fiscalYear)
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        ),
    [entries, category, fiscalYear],
  );
  const totals = categoryEntries.reduce(
    (sum, entry) => ({ ...sum, [entry.kind]: sum[entry.kind] + entry.amount }),
    { income: 0, expense: 0 },
  );
  const balances = new Map<string, number>();
  let running = opening;
  categoryEntries.forEach((entry) => {
    running += entry.kind === "income" ? entry.amount : -entry.amount;
    balances.set(entry.id, running);
  });
  const visible = categoryEntries
    .filter(
      (entry) =>
        (kindFilter === "all" || entry.kind === kindFilter) &&
        (!query ||
          `${entry.description} ${entry.documentNo} ${entry.party}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .reverse();
  const saveEntries = (next: Entry[]) => {
    scopedStorage.setItem(key(school), JSON.stringify(next));
    setEntries(next);
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
  const save = () => {
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
    try {
      saveEntries(
        editing
          ? entries.map((entry) => (entry.id === editing ? item : entry))
          : [...entries, item],
      );
      setOpen(false);
    } catch {
      setError("บันทึกไม่ได้ พื้นที่จัดเก็บข้อมูลอาจเต็ม กรุณาลดขนาดไฟล์แนบ");
    }
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
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center sm:p-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            กำลังดูประเภทเงิน
          </p>
          <p className="mt-1 text-xs text-slate-500">
            เลือกบัญชีที่ต้องการดูหรือบันทึกรายการ
          </p>
        </div>
        <select
          aria-label="ประเภทเงิน"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-900 outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100 lg:ml-auto lg:max-w-sm"
        >
          {options.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <div className="flex w-full gap-2 lg:w-auto lg:shrink-0"><button onClick={() => start("income")} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 lg:flex-none"><ArrowDownLeft size={18}/> บันทึกรายรับ</button><button onClick={() => start("expense")} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 lg:flex-none"><ArrowUpRight size={18}/> บันทึกรายจ่าย</button></div>
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
            value: opening + totals.income - totals.expense,
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
              ฿ <AnimatedNumber value={value} format={money} />
            </p>
            {label === "ยอดยกมา" ? (
              <button
                onClick={() => setEditingOpening(true)}
                className="mt-3 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
              >
                แก้ไขยอดยกมา
              </button>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                {label === "คงเหลือ"
                  ? "หลังหักรายจ่ายทั้งหมด"
                  : `${categoryEntries.length} รายการในทะเบียน`}
              </p>
            )}
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
          <div className="mr-auto">
            <h3 className="font-semibold">รายการในทะเบียน</h3>
            <p className="text-xs text-slate-500">
              {categoryEntries.length} รายการ · {category}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
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
          <label className="relative w-full sm:w-64">
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
          <p className="p-8 text-center text-sm text-slate-500 sm:hidden">
            ยังไม่มีรายการในประเภทเงินนี้
          </p>
        )}
        <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
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
                  <button
                    onClick={() => start(entry.kind, entry)}
                    aria-label="แก้ไขรายการ"
                    className="p-1 text-blue-700"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("ลบรายการนี้?"))
                        saveEntries(
                          entries.filter((item) => item.id !== entry.id),
                        );
                    }}
                    aria-label="ลบรายการ"
                    className="p-1 text-rose-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[900px] text-left text-sm">
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
                  <th key={h} className="px-4 py-3 font-semibold">
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
                  <td className="whitespace-nowrap px-4 py-3">
                    {thaiDate(entry.date)}
                  </td>
                  <td className="px-4 py-3">{entry.documentNo || "–"}</td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">{accountNames[entry.account]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                    {entry.kind === "income" ? money(entry.amount) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-700">
                    {entry.kind === "expense" ? money(entry.amount) : "–"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {money(balances.get(entry.id) || 0)}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="whitespace-nowrap px-3 py-3">
                    <button
                      onClick={() => start(entry.kind, entry)}
                      aria-label="แก้ไขรายการ"
                      className="rounded p-2 text-blue-700 hover:bg-blue-50 dark:text-blue-300"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm("ลบรายการนี้?"))
                          saveEntries(
                            entries.filter((item) => item.id !== entry.id),
                          );
                      }}
                      aria-label="ลบรายการ"
                      className="rounded p-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-10 text-center text-sm text-slate-500">
              ยังไม่มีรายการในประเภทเงินนี้
            </div>
          )}
        </div>
      </section>
      {editingOpening && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-slate-900"
          >
            <h3 className="text-lg font-semibold">ยอดยกมา · {category}</h3>
            <p className="mt-1 text-sm text-slate-500">
              ใช้เป็นยอดตั้งต้นของทะเบียนประเภทเงินนี้
            </p>
            <input
              autoFocus
              type="number"
              step="0.01"
              defaultValue={opening}
              id="opening-amount"
              className="mt-4 w-full rounded-lg border bg-white p-3 text-slate-900"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditingOpening(false)}
                className="rounded-lg border px-4 py-2"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const field = document.getElementById(
                    "opening-amount",
                  ) as HTMLInputElement;
                  const n = Number(field.value);
                  if (!Number.isFinite(n)) return;
                  const next = { ...openingBalances, [openingKey]: n };
                  scopedStorage.setItem(
                    `${key(school)}:opening`,
                    JSON.stringify(next),
                  );
                  setOpeningBalances(next);
                  setEditingOpening(false);
                }}
                className="rounded-lg bg-blue-700 px-4 py-2 text-white"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="income">รายรับ</option>
                  <option value="expense">รายจ่าย</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                วันที่
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, date: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">
                ประเภทเงิน
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, category: e.target.value }))
                  }
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50/50 p-3 text-slate-900 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                onClick={save}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white"
              >
                <Plus size={17} /> บันทึกรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

