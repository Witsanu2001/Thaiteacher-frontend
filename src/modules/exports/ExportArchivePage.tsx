import { useState } from "react";
import type { User } from "firebase/auth";
import { createPortal } from "react-dom";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Printer,
  Trash2,
} from "lucide-react";
import DailyReportExport from "./DailyReportExport";
import FinanceBackupPanel from "./FinanceBackupPanel";
import type { DailyReport } from "../../shared/funtion/types";
import {
  loadReportExports,
  removeReportExport,
  type ReportExportRecord,
} from "../../shared/funtion/reportExportArchive";
import { thaiDate } from "../../shared/funtion/thaiDate";

const formatStyle = {
  Excel: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PDF: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  Word: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Print: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
} as const;

function ExportFormatIcon({ format }: { format: ReportExportRecord["format"] }) {
  return (
    <span aria-label={format === "Print" ? "พิมพ์" : format} className={`relative grid size-12 shrink-0 place-items-center rounded-xl ${formatStyle[format]}`}>
      {format === "Excel" ? <FileSpreadsheet size={25} strokeWidth={1.8} />
        : format === "Print" ? <Printer size={25} strokeWidth={1.8} />
          : <FileText size={25} strokeWidth={1.8} />}
      {format !== "Print" && <span className="absolute -bottom-1 -right-1 rounded bg-current px-1 py-px text-[8px] font-black leading-none shadow-sm"><span className={format === "Excel" ? "text-white dark:text-emerald-950" : format === "PDF" ? "text-white dark:text-rose-950" : "text-white dark:text-blue-950"}>{format === "Excel" ? "XLS" : format === "Word" ? "DOC" : "PDF"}</span></span>}
    </span>
  );
}

export default function ExportArchivePage({
  school,
  reports,
  user,
  viewAsUid,
  demo,
  onPreviewCurrent,
}: {
  school: string;
  reports: DailyReport[];
  user?: User;
  viewAsUid?: string;
  demo: boolean;
  onPreviewCurrent?: () => void;
}) {
  const [items, setItems] = useState<ReportExportRecord[]>(() =>
    loadReportExports(school),
  );
  const [selected, setSelected] = useState<ReportExportRecord | null>(null);
  const remove = (id: string) => {
    if (!window.confirm("ลบประวัติรายการส่งออกนี้?")) return;
    removeReportExport(school, id);
    setItems(loadReportExports(school));
  };
  const created = (iso: string) =>
    new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(iso));
  return (
    <div className="space-y-5">
      <FinanceBackupPanel school={school} reports={reports} user={user} viewAsUid={viewAsUid} demo={demo} />
      <div data-tour="export-current" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">เอกสารที่เคยส่งออก</h2>
          <p className="mt-1 text-sm text-slate-500">
            เปิดดูข้อมูลและรูปแบบรายงาน ณ วันที่กดส่งออกได้อีกครั้ง
          </p>
        </div>
        {onPreviewCurrent && (
          <button
            onClick={onPreviewCurrent}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white"
          >
            <FileDown size={18} /> ส่งออกรายงานปัจจุบัน
          </button>
        )}
      </div>
      <section data-tour="export-history" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <History size={20} />
          </span>
          <div>
            <h3 className="font-semibold">ประวัติการส่งออก</h3>
            <p className="text-xs text-slate-500">
              {items.length} รายการ · {school}
            </p>
          </div>
        </div>
        {items.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-blue-50/30 dark:hover:bg-slate-800/50 sm:p-5"
              >
                <ExportFormatIcon format={item.format} />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold">
                    รายงานเงินคงเหลือประจำวัน · {thaiDate(item.date)}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.format === "Print" ? "เปิดหน้าพิมพ์" : item.format === "PDF" ? "บันทึก PDF" : `ดาวน์โหลด ${item.format}`} {" "}
                    · {created(item.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelected(item)}
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:text-blue-300"
                  >
                    เปิดตัวอย่าง
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    aria-label="ลบประวัติ"
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <History size={25} />
            </span>
            <h4 className="mt-4 font-semibold">ยังไม่มีประวัติการส่งออก</h4>
            <p className="mt-1 text-sm text-slate-500">
              เมื่อกด Excel, PDF หรือ Word จากตัวอย่างรายงาน รายการจะปรากฏที่นี่
            </p>
          </div>
        )}
      </section>
      {selected &&
        createPortal(
          <DailyReportExport
            school={selected.school}
            date={selected.date}
            rows={selected.rows}
            archive={{ layout: selected.layout, config: selected.config }}
            onClose={() => {
              setSelected(null);
              setItems(loadReportExports(school));
            }}
          />,
          document.body,
        )}
    </div>
  );
}
