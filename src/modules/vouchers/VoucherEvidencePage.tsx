import { scopedStorage } from "../../shared/funtion/scopedStorage";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { loadCashbookEntries } from "../../config/services/cashbook.service";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  FileCheck2,
  FilePlus2,
  FileText,
  Paperclip,
  Printer,
  Search,
  X,
} from "lucide-react";
import { thaiDate } from "../../shared/funtion/thaiDate";
import { fiscalYearOf } from "../../shared/funtion/fiscalYear";

import type {
  CashbookEntry as Entry,
  EvidenceAttachment as Attachment,
} from "../../shared/funtion/types";
import { money } from "../../shared/funtion/money";
import AnimatedNumber from "../../shared/components/AnimatedNumber";
import { readJson } from "../../shared/funtion/storage";
type Voucher = {
  number: string;
  party: string;
  purpose: string;
  note: string;
  attachments: Attachment[];
};
const key = (school: string) => `school-vouchers:${school}`;
const accountNames = {
  cash: "เงินสด",
  bank: "เงินฝากธนาคาร",
  government: "เงินฝากส่วนราชการผู้เบิก",
};
export default function VoucherEvidencePage({
  school,
  fiscalYear,
  onNavigate,
  user,
  viewAsUid,
  demo = false,
}: {
  school: string;
  fiscalYear: number;
  onNavigate: () => void;
  user?: User;
  viewAsUid?: string;
  demo?: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    readJson<Entry[]>(`school-cashbook:${school}`, []).filter(
      (entry) => fiscalYearOf(entry.date) === fiscalYear,
    ),
  );
  useEffect(() => {
    if (demo || !user) return;
    let active = true;
    void loadCashbookEntries(user, viewAsUid).then((remote) => {
      if (!active) return;
      const local = readJson<Entry[]>(`school-cashbook:${school}`, []);
      const linked = readJson<string[]>(`school-cashbook:${school}:linked-ids`, []);
      const remoteIds = new Set(remote.map((entry) => entry.id));
      const legacy = local.filter((entry) => !remoteIds.has(entry.id) && !linked.includes(entry.id));
      const localById = new Map(local.map((entry) => [entry.id, entry]));
      setEntries([...legacy, ...remote.map((entry) => ({ ...entry, attachment: localById.get(entry.id)?.attachment }))].filter((entry) => fiscalYearOf(entry.date) === fiscalYear));
    }).catch(() => {});
    return () => { active = false; };
  }, [school, fiscalYear, user, viewAsUid, demo]);
  const [vouchers, setVouchers] = useState<Record<string, Voucher>>(() =>
    readJson<Record<string, Voucher>>(key(school), {}),
  );
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<Voucher | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Entry | null>(null);
  const visible = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            (filter === "all" || entry.kind === filter) &&
            (!query ||
              `${entry.description} ${entry.documentNo} ${entry.party} ${vouchers[entry.id]?.number || ""}`
                .toLowerCase()
                .includes(query.toLowerCase())),
        )
        .sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        ),
    [entries, filter, query, vouchers],
  );
  const count = {
    income: entries.filter((e) => e.kind === "income").length,
    expense: entries.filter((e) => e.kind === "expense").length,
    ready: entries.filter((e) => Boolean(vouchers[e.id]?.number)).length,
  };
  const openEditor = (entry: Entry) => {
    setSelected(entry);
    setDraft(
      vouchers[entry.id] || {
        number: entry.documentNo || "",
        party: entry.party || "",
        purpose: entry.description,
        note: entry.note || "",
        attachments: [],
      },
    );
    setError("");
  };
  const save = () => {
    if (!selected || !draft) return;
    if (!draft.number.trim() || !draft.purpose.trim()) {
      setError("กรอกเลขที่ใบสำคัญและรายการก่อนบันทึก");
      return;
    }
    try {
      const next = {
        ...vouchers,
        [selected.id]: {
          ...draft,
          number: draft.number.trim(),
          purpose: draft.purpose.trim(),
        },
      };
      scopedStorage.setItem(key(school), JSON.stringify(next));
      setVouchers(next);
      setSelected(null);
      setDraft(null);
    } catch {
      setError("บันทึกไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม กรุณาลดขนาดไฟล์แนบ");
    }
  };
  const addFile = (file?: File) => {
    if (!file || !draft) return;
    if (file.size > 1024 * 1024) {
      setError("ไฟล์แนบแต่ละไฟล์ต้องไม่เกิน 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setDraft((current) =>
        current
          ? {
              ...current,
              attachments: [
                ...current.attachments,
                { name: file.name, data: String(reader.result) },
              ],
            }
          : current,
      );
    reader.readAsDataURL(file);
  };
  const voucher = preview ? vouchers[preview.id] : null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">ใบสำคัญและหลักฐาน</h2>
          <p className="mt-1 text-sm text-slate-500">
            จัดทำใบสำคัญจากรายการรับ–จ่ายของโรงเรียน
            และเก็บไฟล์หลักฐานไว้กับรายการ
          </p>
        </div>
        <button
          onClick={onNavigate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
        >
          <FilePlus2 size={18} /> ไปบันทึกรายการ <ArrowRight size={16} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "รายการรับเงิน",
            value: count.income,
            icon: FileText,
            tone: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
          },
          {
            label: "รายการจ่ายเงิน",
            value: count.expense,
            icon: FileText,
            tone: "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40",
          },
          {
            label: "จัดทำใบสำคัญแล้ว",
            value: count.ready,
            icon: FileCheck2,
            tone: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40",
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <article
            key={label}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums"><AnimatedNumber value={value} /></p>
            </div>
            <span
              className={`grid size-12 place-items-center rounded-xl ${tone}`}
            >
              <Icon size={22} />
            </span>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
          <div className="mr-auto">
            <h3 className="font-semibold">รายการเอกสาร</h3>
            <p className="text-xs text-slate-500">
              เลือกบรรทัดเพื่อจัดทำหรือแก้ไขใบสำคัญ
            </p>
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                ["all", "ทั้งหมด"],
                ["income", "ใบรับ"],
                ["expense", "ใบจ่าย"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-2 text-sm ${filter === value ? "bg-white font-semibold text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-56">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขที่หรือรายการ"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>
        <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
          {visible.map((entry) => {
            const saved = vouchers[entry.id];
            return (
              <article key={entry.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.kind === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                    >
                      {entry.kind === "income" ? "ใบสำคัญรับ" : "ใบสำคัญจ่าย"}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      {thaiDate(entry.date)} ·{" "}
                      {saved?.number || "ยังไม่มีเลขที่ใบสำคัญ"}
                    </p>
                    <h4 className="mt-1 font-semibold">{entry.description}</h4>
                  </div>
                  <strong className="whitespace-nowrap tabular-nums">
                    ฿ {money(entry.amount)}
                  </strong>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                  <span
                    className={
                      saved
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-500"
                    }
                  >
                    {saved ? "พร้อมพิมพ์" : "รอจัดทำ"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditor(entry)}
                      className="font-semibold text-blue-700 dark:text-blue-300"
                    >
                      {saved ? "แก้ไข" : "จัดทำ"}
                    </button>
                    {saved && (
                      <button
                        onClick={() => setPreview(entry)}
                        className="font-semibold text-slate-700 dark:text-slate-200"
                      >
                        ดูตัวอย่าง
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-blue-50/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {[
                  "ประเภท",
                  "วันที่",
                  "เลขที่ใบสำคัญ",
                  "รายการ",
                  "จำนวนเงิน",
                  "หลักฐาน",
                  "สถานะ",
                  "",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((entry) => {
                const saved = vouchers[entry.id];
                const evidence =
                  (entry.attachment ? 1 : 0) + (saved?.attachments.length || 0);
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.kind === "income" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}
                      >
                        {entry.kind === "income" ? "ใบรับ" : "ใบจ่าย"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {thaiDate(entry.date)}
                    </td>
                    <td className="px-4 py-3">{saved?.number || "–"}</td>
                    <td className="px-4 py-3 font-medium">
                      {entry.description}
                      <span className="block text-xs font-normal text-slate-500">
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {money(entry.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {evidence ? (
                        <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                          <Paperclip size={14} />
                          {evidence} ไฟล์
                        </span>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          saved
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-slate-500"
                        }
                      >
                        {saved ? "พร้อมพิมพ์" : "รอจัดทำ"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => openEditor(entry)}
                        className="rounded-lg px-2 py-2 font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300"
                      >
                        {saved ? "แก้ไข" : "จัดทำ"}
                      </button>
                      {saved && (
                        <button
                          onClick={() => setPreview(entry)}
                          className="rounded-lg px-2 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                        >
                          ดูตัวอย่าง
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            {entries.length
              ? "ไม่พบรายการที่ค้นหา"
              : "ยังไม่มีรายการรับ–จ่าย ไปบันทึกรายการก่อนเพื่อจัดทำใบสำคัญ"}
          </div>
        )}
      </section>
      {selected && draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            className="mx-auto max-w-xl rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {selected.kind === "income"
                    ? "ใบสำคัญรับเงิน"
                    : "ใบสำคัญจ่ายเงิน"}
                </p>
                <h3 className="mt-1 text-xl font-semibold">จัดทำใบสำคัญ</h3>
                <p className="text-sm text-slate-500">
                  {thaiDate(selected.date)} · ฿ {money(selected.amount)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="ปิด">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                เลขที่ใบสำคัญ
                <input
                  value={draft.number}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, number: e.target.value } : d))
                  }
                  placeholder="เช่น ร.001/2569"
                  className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                {selected.kind === "income" ? "รับเงินจาก" : "จ่ายเงินให้"}
                <input
                  value={draft.party}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, party: e.target.value } : d))
                  }
                  placeholder="ชื่อบุคคลหรือหน่วยงาน"
                  className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                รายการ
                <input
                  value={draft.purpose}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, purpose: e.target.value } : d))
                  }
                  className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                หมายเหตุ
                <textarea
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, note: e.target.value } : d))
                  }
                  rows={2}
                  className="rounded-lg border border-slate-300 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="grid gap-1 text-sm font-medium sm:col-span-2">
                แนบหลักฐาน
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    addFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  className="min-w-0 rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-3 text-sm dark:border-blue-800 dark:bg-slate-800"
                />
              </label>
            </div>
            {(selected.attachment || draft.attachments.length > 0) && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  หลักฐานที่แนบ
                </p>
                {selected.attachment && (
                  <a
                    href={selected.attachment.data}
                    download={selected.attachment.name}
                    className="block py-1 text-sm text-blue-700 dark:text-blue-300"
                  >
                    {selected.attachment.name} · จากรายการรับ–จ่าย
                  </a>
                )}
                {draft.attachments.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <a
                      href={file.data}
                      download={file.name}
                      className="truncate text-sm text-blue-700 dark:text-blue-300"
                    >
                      {file.name}
                    </a>
                    <button
                      onClick={() =>
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                attachments: d.attachments.filter(
                                  (_, index) => index !== i,
                                ),
                              }
                            : d,
                        )
                      }
                      className="text-xs text-rose-600"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border px-4 py-2"
              >
                ยกเลิก
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-blue-700 px-5 py-2 font-semibold text-white"
              >
                บันทึกใบสำคัญ
              </button>
            </div>
          </div>
        </div>
      )}
      {preview &&
        voucher &&
        createPortal(
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/70 p-3 sm:p-6 print:static print:bg-white print:p-0">
            <div className="mx-auto max-w-[210mm]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 dark:bg-slate-900 print:hidden">
                <h3 className="font-semibold">ตัวอย่างใบสำคัญ</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm text-white"
                  >
                    <Printer size={16} /> พิมพ์ / PDF
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    aria-label="ปิด"
                    className="rounded-lg border p-2"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <article className="box-border min-h-[297mm] bg-white px-[18mm] py-[20mm] font-sarabun text-[14pt] text-black shadow-xl print:h-[297mm] print:shadow-none">
                <header className="mb-8 text-center">
                  <p className="font-bold">{school}</p>
                  <h2 className="mt-2 text-xl font-bold">
                    {preview.kind === "income"
                      ? "ใบสำคัญรับเงิน"
                      : "ใบสำคัญจ่ายเงิน"}
                  </h2>
                </header>
                <div className="flex justify-between border-b border-black pb-2">
                  <p>เลขที่ {voucher.number}</p>
                  <p>วันที่ {thaiDate(preview.date)}</p>
                </div>
                <div className="mt-8 space-y-5">
                  <p>
                    {preview.kind === "income" ? "รับเงินจาก" : "จ่ายเงินให้"}{" "}
                    <strong>
                      {voucher.party ||
                        "............................................."}
                    </strong>
                  </p>
                  <p>
                    เป็นเงินสำหรับ <strong>{voucher.purpose}</strong>
                  </p>
                  <p>
                    ประเภทเงิน {preview.category} ·{" "}
                    {accountNames[preview.account]}
                  </p>
                  <p>
                    จำนวนเงิน <strong>฿ {money(preview.amount)}</strong>
                  </p>
                  {voucher.note && <p>หมายเหตุ {voucher.note}</p>}
                </div>
                <div className="mt-16 grid grid-cols-2 gap-8 text-center">
                  <p>
                    ลงชื่อ.............................................
                    <br />(
                    {preview.kind === "income" ? "ผู้รับเงิน" : "ผู้จ่ายเงิน"})
                  </p>
                  <p>
                    ลงชื่อ.............................................
                    <br />(
                    {preview.kind === "income" ? "ผู้รับเงินจาก" : "ผู้รับเงิน"}
                    )
                  </p>
                </div>
                <div className="mt-14 border-t border-black pt-3 text-sm">
                  <p>
                    หลักฐานแนบ{" "}
                    {[
                      preview.attachment?.name,
                      ...voucher.attachments.map((file) => file.name),
                    ]
                      .filter(Boolean)
                      .join(", ") || "ไม่มี"}
                  </p>
                </div>
              </article>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
