import { scopedStorage } from "../../shared/funtion/scopedStorage";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { recordReportExport } from "../../shared/funtion/reportExportArchive";
import { originalReportLayout, renderReportPages, type ReportPageImage } from "./renderReportPages";
import {
  blockDateText,
  hasSavedReportLayout,
  loadReportLayout,
  type ReportLayout,
} from "../../shared/funtion/reportPageLayout";
import {
  defaultExportConfig,
  type ExportFormConfig,
} from "../../shared/funtion/exportFormConfig";
import { FileDown, FileSpreadsheet, FileText, Loader2, Printer, X } from "lucide-react";
import { buildReportWord } from "./buildReportWord";
import { appendReportSheets } from "./reportExcelSheet";
import type { BalanceRow as Row } from "../../shared/funtion/types";
const dateParts = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return {
    year: year + 543,
    month: new Intl.DateTimeFormat("th-TH", { month: "long" }).format(
      new Date(year, month - 1, 1),
    ),
    day,
  };
};
export default function DailyReportExport({
  school,
  date,
  rows,
  onClose,
  archive,
}: {
  school: string;
  date: string;
  rows: Row[];
  onClose: () => void;
  archive?: { layout: ReportLayout | null; config: ExportFormConfig };
}) {
  const [pageImages, setPageImages] = useState<ReportPageImage[]>([]);
  const [exporting, setExporting] = useState<"Excel" | "PDF" | "Word" | null>(null);
  const [exportError, setExportError] = useState("");
  const [config] = useState<ExportFormConfig>(() => {
    if (archive) return archive.config;
    try {
      const saved = JSON.parse(
        scopedStorage.getItem(`school-export-form:${school}`) || "null",
      );
      return saved
        ? {
            ...defaultExportConfig,
            ...saved,
            committeeNames:
              Array.isArray(saved.committeeNames) &&
              saved.committeeNames.length === 3
                ? saved.committeeNames
                : ["", "", ""],
            committeePositions:
              Array.isArray(saved.committeePositions) &&
              saved.committeePositions.length === 3
                ? saved.committeePositions
                : ["กรรมการ", "กรรมการ", "กรรมการ"],
          }
        : defaultExportConfig;
    } catch {
      return defaultExportConfig;
    }
  });
  const [layout] = useState<ReportLayout | null>(() =>
    archive
      ? archive.layout
      : hasSavedReportLayout(school)
        ? loadReportLayout(school)
        : null,
  );
  useEffect(() => {
    let active = true;
    void renderReportPages(layout || originalReportLayout(school, date, config), date, rows)
      .then(pages => { if (active) setPageImages(pages); })
      .catch(error => {
        console.error("Could not render report pages", error);
        if (active) setExportError("โหลดแบบรายงานหรือฟอนต์ไม่สำเร็จ กรุณาปิดแล้วเปิดตัวอย่างอีกครั้ง");
      });
    return () => { active = false; };
  }, [layout, school, date, config, rows]);
  const remember = (format: "Excel" | "PDF" | "Word" | "Print") => {
    const savedLayout = layout ? structuredClone(layout) : null;
    if (savedLayout)
      for (const page of savedLayout.pages)
        for (const row of page.rows)
          for (const block of row.blocks)
            if (block?.type === "date") {
              block.text = blockDateText(block, date);
              block.dateMode = "manual";
            }
    const savedConfig = structuredClone(config);
    if (savedConfig.receiptDateMode !== "manual") {
      savedConfig.receiptDateMode = "manual";
      savedConfig.manualDate = receiptDate;
    }
    recordReportExport({
      school,
      date,
      rows: structuredClone(rows),
      layout: savedLayout,
      config: savedConfig,
      format,
    });
  };
  const dateText = dateParts(date);
  const todayIso = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const shiftDay = (iso: string, offset: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + offset));
    return x.toISOString().slice(0, 10);
  };
  const receiptIso =
    config.receiptDateMode === "today"
      ? todayIso()
      : config.receiptDateMode === "previous"
        ? shiftDay(date, -1)
        : config.receiptDateMode === "next"
          ? shiftDay(date, 1)
          : date;
  const receiptParts = dateParts(receiptIso);
  const receiptDate =
    config.receiptDateMode === "manual"
      ? config.manualDate
      : `เมื่อวันที่ ${receiptParts.day} เดือน ${receiptParts.month} พ.ศ. ${receiptParts.year}`;
  const schoolTitle = config.schoolDisplayName.trim() || school;
  const signer = (name: string) =>
    name.trim()
      ? `(${name.trim()})`
      : "(....................................................)";

  const totals = rows.reduce(
    (sum, row) => ({
      cash: sum.cash + (row.group ? 0 : row.cash),
      bank: sum.bank + (row.group ? 0 : row.bank),
      government: sum.government + (row.group ? 0 : row.government),
    }),
    { cash: 0, bank: 0, government: 0 },
  );
  const downloadExcel = async () => {
    if (layout) {
      const ExcelJS = (await import("exceljs")).default;
      const book = new ExcelJS.Workbook();
      appendReportSheets(book, layout, date, rows);
      const buffer = await book.xlsx.writeBuffer();
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `รายงานเงินคงเหลือ_${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      remember("Excel");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const data: (string | number)[][] = [
      [schoolTitle],
      [config.reportTitle],
      [
        `ประจำวันที่ ${dateText.day} เดือน ${dateText.month} พ.ศ. ${dateText.year}`,
      ],
      [
        "ประเภท",
        "เงินสด",
        "เงินฝากธนาคาร",
        "เงินฝากส่วน-ราชการผู้เบิก",
        "รวม",
        "หมายเหตุ",
      ],
      ...rows.map((row) => [
        `${row.level ? " - " + (row.level === 2 ? "   " : "") : ""}${row.name}`,
        row.group ? "" : row.cash,
        row.group ? "" : row.bank,
        row.group ? "" : row.government,
        row.group ? "" : row.cash + row.bank + row.government,
        row.note ?? "",
      ]),
      [
        "รวมทั้งสิ้น",
        totals.cash,
        totals.bank,
        totals.government,
        totals.cash + totals.bank + totals.government,
        "",
      ],
      [],
      [],
      [
        "",
        "",
        "",
        "ลงชื่อ.............................................ผู้จัดทำรายงาน",
      ],
      ["", "", "", signer(config.makerName)],
      [
        "",
        "",
        "",
        `ตำแหน่ง ${config.makerPosition || "............................................."}`,
      ],
      [config.committeeStatement],
      [],
      [
        config.committeeNames[0] ||
          ".............................................",
        config.committeeNames[1] ||
          ".............................................",
        "",
        "",
        config.committeeNames[2] ||
          ".............................................",
      ],
      [
        config.committeePositions[0],
        config.committeePositions[1],
        "",
        "",
        config.committeePositions[2],
      ],
      [],
      [
        "",
        "",
        "",
        "ลงชื่อ.............................................หัวหน้าหน่วยงาน",
      ],
      ["", "", "", signer(config.headName)],
      [
        "",
        "",
        "",
        `ตำแหน่ง ${config.headPosition || "............................................."}`,
      ],
      [],
      [config.receiptStatement, "", "", receiptDate],
      [
        "",
        "",
        "",
        `ลงชื่อ ${config.receiptName || "............................................."} ${config.receiptPosition}`,
      ],
      [
        "",
        "",
        "",
        `ลงชื่อ ${config.subheadName || "............................................."} ${config.subheadPosition}`,
      ],
    ];
    const ExcelJS = (await import("exceljs")).default;
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("รายงานเงินคงเหลือ", {
      pageSetup: {
        paperSize: 9,
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
      },
    });
    sheet.columns = [
      { width: 49 },
      { width: 13 },
      { width: 18 },
      { width: 19 },
      { width: 15 },
      { width: 22 },
    ];
    data.forEach((row) => sheet.addRow(row));
    const totalRow = rows.length + 5;
    for (let r = 1; r <= 3; r++) sheet.mergeCells(r, 1, r, 6);
    const offset = rows.length;
    for (const n of [7, 8, 9, 15, 16, 17, 19, 20, 21])
      sheet.mergeCells(offset + n + 1, 4, offset + n + 1, 6);
    sheet.mergeCells(offset + 11, 1, offset + 11, 6);
    sheet.mergeCells(offset + 20, 1, offset + 20, 3);
    sheet.eachRow((row) =>
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = {
          name: "TH Sarabun PSK",
          size:
            config.tableFontSize === "compact"
              ? 14
              : config.tableFontSize === "large"
                ? 18
                : 16,
          bold: row.number <= 3 || row.number === 4 || row.number === totalRow,
        };
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal:
            row.number <= 3
              ? "center"
              : typeof cell.value === "number"
                ? "right"
                : "left",
        };
        if (row.number >= 4 && row.number <= totalRow) {
          const style = config.tableBorder === "medium" ? "medium" : "thin";
          cell.border = {
            top: { style },
            left: { style },
            bottom: { style },
            right: { style },
          };
        }
        if (typeof cell.value === "number") cell.numFmt = "#,##0.00";
      }),
    );
    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 25;
    sheet.getRow(3).height = 24;
    sheet.getRow(4).height = 32;
    for (let r = 5; r <= totalRow; r++)
      sheet.getRow(r).height = config.tableRowSpacing === "compact" ? 23 : 30;
    sheet.getRow(offset + 20).height = 36;
    if (config.showDivider)
      for (let c = 1; c <= 6; c++)
        sheet.getCell(offset + 20, c).border = { top: { style: "thin" } };
    if (config.shadeHeader)
      sheet.getRow(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF1F8" },
      };
    sheet.getRow(totalRow).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAF1F8" },
    };
    sheet.pageSetup.printArea = `A1:F${data.length}`;
    const buffer = await book.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `รายงานเงินคงเหลือ_${date}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    remember("Excel");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadWord = async () => {
    const blob = await buildReportWord({ school: schoolTitle, date, rows, layout, config });
    downloadBlob(blob, `รายงานเงินคงเหลือ_${date}.docx`);
    remember("Word");
  };
  const createPdf = async () => {
    if (!pageImages.length) throw new Error("ไม่พบหน้ารายงาน");
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    for (const [index, page] of pageImages.entries()) {
      if (index) pdf.addPage();
      pdf.addImage(page.image, "PNG", 0, 0, 210, 297);
    }
    return pdf;
  };
  const downloadPdf = async () => {
    const pdf = await createPdf();
    pdf.save(`รายงานเงินคงเหลือ_${date}.pdf`);
    remember("PDF");
  };
  const printReport = () => {
    if (!pageImages.length) return;
    setExportError("");
    remember("Print");
    window.print();
  };
  const runExport = async (format: "Excel" | "PDF" | "Word") => {
    if (exporting) return;
    setExportError("");
    setExporting(format);
    try {
      if (format === "Excel") await downloadExcel();
      else if (format === "PDF") await downloadPdf();
      else await downloadWord();
    } catch (error) {
      console.error(`Export ${format} failed`, error);
      setExportError(error instanceof Error && error.message === "report_page_overflow"
        ? "เนื้อหาเกินหน้ากระดาษ A4 กรุณาลดขนาดตัวอักษรหรือเพิ่มหน้ากระดาษก่อนบันทึก PDF"
        : `สร้างไฟล์ ${format} ไม่สำเร็จ กรุณาลองอีกครั้ง`);
    } finally {
      setExporting(null);
    }
  };
  return createPortal(
    <div
      data-report-print-root
      className={`${document.querySelector(".dark") ? "dark" : ""} fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 sm:p-6 print:static print:overflow-visible print:bg-white print:p-0`}
      role="dialog"
      aria-modal="true"
      aria-label="ตัวอย่างรายงานก่อนส่งออก"
    >
      <div className="mx-auto max-w-[210mm] print:mx-0 print:w-full print:max-w-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 dark:bg-slate-900 print:hidden">
          <div>
            <h2 className="font-semibold">ตัวอย่างรายงานก่อนส่งออก</h2>
            <p className="text-xs text-slate-500">
              ตรวจยอดและข้อความลงชื่อก่อนบันทึกไฟล์
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runExport("Excel")}
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
            >
              {exporting === "Excel" ? <Loader2 size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />} Excel
            </button>
            <button
              type="button"
              onClick={printReport}
              disabled={Boolean(exporting) || !pageImages.length}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
            >
              <Printer size={17} /> พิมพ์
            </button>
            <button
              type="button"
              onClick={() => void runExport("PDF")}
              disabled={Boolean(exporting) || !pageImages.length}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm text-white"
            >
              {exporting === "PDF" ? <Loader2 size={17} className="animate-spin" /> : <FileDown size={17} />} บันทึก PDF
            </button>
            <button
              type="button"
              onClick={() => void runExport("Word")}
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
            >
              {exporting === "Word" ? <Loader2 size={17} className="animate-spin" /> : <FileText size={17} />} Word
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดตัวอย่าง"
              className="rounded-lg border border-slate-300 p-2 dark:border-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {exportError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{exportError}</p>}
        {!pageImages.length && !exportError && <div role="status" className="grid min-h-72 place-items-center rounded-xl bg-white text-blue-600"><Loader2 className="size-8 animate-spin" aria-label="กำลังเตรียมรายงาน" /></div>}
        <div data-report-print-pages className="space-y-5 print:space-y-0">
          {pageImages.map((page, index) => (
            <img key={index} data-report-print-page src={page.image} alt={`รายงานเงินคงเหลือ หน้าที่ ${index + 1}`} className="mx-auto block h-auto w-full bg-white shadow-xl print:shadow-none" />
          ))}
        </div>
      </div>
    </div>, document.body
  );
}
