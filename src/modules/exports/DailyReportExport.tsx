import { scopedStorage } from "../../shared/funtion/scopedStorage";
import { useRef, useState } from "react";
import { recordReportExport } from "../../shared/funtion/reportExportArchive";
import ReportPageCanvas from "../../shared/components/ReportPageCanvas";
import {
  blockDateText,
  defaultTableHeaders,
  signatureLines,
  hasSavedReportLayout,
  loadReportLayout,
  type ReportLayout,
} from "../../shared/funtion/reportPageLayout";
import {
  defaultExportConfig,
  type ExportFormConfig,
  tableFontClass,
  tablePaddingClass,
  tableBorderClass,
} from "../../shared/funtion/exportFormConfig";
import { FileDown, FileSpreadsheet, FileText, Loader2, Printer, X } from "lucide-react";
import { buildReportWord } from "./buildReportWord";
import type { BalanceRow as Row } from "../../shared/funtion/types";
import { money } from "../../shared/funtion/money";
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
  const reportRef = useRef<HTMLDivElement>(null);
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
      layout.pages.forEach((page, index) => {
        const sheet = book.addWorksheet(`หน้า ${index + 1}`, {
          pageSetup: {
            paperSize: 9,
            orientation: "portrait",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
          },
        });
        sheet.columns = [
          { width: 43 },
          { width: 13 },
          { width: 17 },
          { width: 18 },
          { width: 13 },
          { width: 20 },
        ];
        page.rows.forEach((layoutRow) => {
          if (layoutRow.blocks.every((block) => !block)) {
            sheet.addRow([]).height = 18;
            return;
          }
          const contentRow = layoutRow.blocks.some((block) => block?.type === "table") ? null : sheet.addRow([]);
          layoutRow.blocks.forEach((block, slot) => {
            if (!block) return;
            const start =
              layoutRow.columns === 1
                ? 1
                : layoutRow.columns === 2
                  ? slot * 3 + 1
                  : slot * 2 + 1;
            const end =
              layoutRow.columns === 1
                ? 6
                : layoutRow.columns === 2
                  ? start + 2
                  : start + 1;
            if (block.type === "table") {
              const head = sheet.addRow(
                defaultTableHeaders.map(
                  (label, i) => block.tableHeaders?.[i] ?? label,
                ),
              );
              head.height = Math.max(
                27,
                ...defaultTableHeaders.map(
                  (label, i) =>
                    (block.tableHeaders?.[i] ?? label).split("\n").length *
                    (block.tableHeaderFontSize || 10) *
                    1.7,
                ),
              );
              head.eachCell({ includeEmpty: true }, (cell) => {
                cell.font = {
                  name: "TH Sarabun PSK",
                  size: block.tableHeaderFontSize || 10,
                  bold: block.tableHeaderBold !== false,
                };
                cell.alignment = {
                  horizontal: block.tableHeaderAlign || "center",
                  vertical: "middle",
                  wrapText: true,
                };
                cell.border = {
                  top: { style: "thin" },
                  bottom: { style: "thin" },
                  left: { style: "thin" },
                  right: { style: "thin" },
                };
                if (block.tableHeaderColor !== "white")
                  cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: {
                      argb:
                        block.tableHeaderColor === "blue"
                          ? "FFDBEAFE"
                          : "FFE5E7EB",
                    },
                  };
              });
              [
                ...rows,
                {
                  name: "รวมทั้งสิ้น",
                  cash: totals.cash,
                  bank: totals.bank,
                  government: totals.government,
                  note: "",
                  group: false,
                },
              ].forEach((r) => {
                const values = [
                  r.name,
                  r.group ? "" : r.cash,
                  r.group ? "" : r.bank,
                  r.group ? "" : r.government,
                  r.group ? "" : r.cash + r.bank + r.government,
                  r.note || "",
                ];
                const rr = sheet.addRow(values);
                rr.height = Math.max(22, (block.tableFontSize || 10) * 1.6);
                rr.font = {
                  name: "TH Sarabun PSK",
                  size: block.tableFontSize || 10,
                  bold: true,
                };
                rr.eachCell({ includeEmpty: true }, (c) => {
                  c.border = {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                  };
                  if (typeof c.value === "number") c.numFmt = "#,##0.00";
                });
              });
              return;
            }
            const value =
              block.type === "date"
                ? blockDateText(block, date)
                : block.type === "signature"
                  ? signatureLines(block).join("\n")
                  : block.type === "divider"
                    ? "________________________________________"
                    : block.text || "";
            const r = contentRow ?? sheet.addRow([]);
            r.getCell(start).value = value;
            if (end > start) sheet.mergeCells(r.number, start, r.number, end);
            r.font = {
              name: "TH Sarabun PSK",
              size: block.fontSize || 12,
              bold: block.bold !== false,
              italic: block.italic === true,
              underline: block.underline === true,
            };
            r.getCell(start).alignment = {
              vertical: "middle",
              wrapText: true,
              horizontal: block.align || "left",
            };
            r.height =
              block.type === "signature"
                ? Math.max(
                    25,
                    signatureLines(block).length * (block.fontSize || 12) * 1.4,
                  )
                : Math.max(25, (block.fontSize || 12) * 1.5);
          });
        });
        sheet.pageSetup.printArea = `A1:F${Math.max(1, sheet.rowCount)}`;
      });
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
  const downloadPdf = async () => {
    const pages = reportRef.current?.querySelectorAll<HTMLElement>("[data-report-page]");
    if (!pages?.length) throw new Error("ไม่พบหน้ารายงาน");
    await document.fonts.ready;
    const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    for (const [index, page] of Array.from(pages).entries()) {
      const image = await toPng(page, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true, style: { boxShadow: "none" } });
      const rect = page.getBoundingClientRect();
      const height = Math.min(297, rect.height / rect.width * 210);
      if (index) pdf.addPage();
      pdf.addImage(image, "PNG", 0, 0, 210, height);
    }
    pdf.save(`รายงานเงินคงเหลือ_${date}.pdf`);
    remember("PDF");
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
      setExportError(`สร้างไฟล์ ${format} ไม่สำเร็จ กรุณาลองอีกครั้ง`);
    } finally {
      setExporting(null);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 p-3 sm:p-6 print:static print:overflow-visible print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label="ตัวอย่างรายงานก่อนส่งออก"
    >
      <div ref={reportRef} className="mx-auto max-w-[210mm]">
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
              onClick={() => { remember("Print"); window.print(); }}
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
            >
              <Printer size={17} /> พิมพ์
            </button>
            <button
              type="button"
              onClick={() => void runExport("PDF")}
              disabled={Boolean(exporting)}
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
        {layout ? (
          <ReportPageCanvas layout={layout} date={date} rows={rows} />
        ) : (
          <article data-report-page className="min-h-[297mm] overflow-x-auto rounded-xl bg-white p-5 font-sarabun text-xl text-black shadow-2xl sm:p-10 print:mx-auto print:min-h-0 print:w-[180mm] print:overflow-visible print:rounded-none print:px-0 print:pt-[12mm] print:pb-[8mm] print:text-[13pt] print:shadow-none">
            <div className="min-w-[720px] print:min-w-0">
              <header className="mb-4 space-y-1 text-center leading-7 print:mb-3 print:space-y-0 print:text-[14pt] print:leading-[1.15]">
                <p className="font-semibold">{schoolTitle}</p>
                <h2 className="font-semibold">{config.reportTitle}</h2>
                <p>
                  ประจำวันที่ {dateText.day} เดือน {dateText.month} พ.ศ.{" "}
                  {dateText.year}
                </p>
              </header>
              <table
                className={`w-full table-fixed border-collapse text-base print:leading-tight ${tableFontClass(config.tableFontSize)}`}
              >
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "ประเภท",
                      "เงินสด",
                      "เงินฝากธนาคาร",
                      "เงินฝากส่วน-ราชการผู้เบิก",
                      "รวม",
                      "หมายเหตุ",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`${tableBorderClass(config.tableBorder)} p-2 text-center font-semibold ${tablePaddingClass(config.tableRowSpacing)} ${config.shadeHeader ? "bg-slate-100" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td
                        className={`${tableBorderClass(config.tableBorder)} p-2 ${tablePaddingClass(config.tableRowSpacing)}`}
                        style={{
                          paddingLeft: `${8 + (row.level ?? 0) * 14}px`,
                        }}
                      >
                        {row.level ? "- " : ""}
                        {row.name}
                      </td>
                      {[
                        row.cash,
                        row.bank,
                        row.government,
                        row.cash + row.bank + row.government,
                      ].map((value, j) => (
                        <td
                          key={j}
                          className={`${tableBorderClass(config.tableBorder)} p-2 text-right tabular-nums ${tablePaddingClass(config.tableRowSpacing)}`}
                        >
                          {row.group ? "" : money(value)}
                        </td>
                      ))}
                      <td
                        className={`${tableBorderClass(config.tableBorder)} p-2 ${tablePaddingClass(config.tableRowSpacing)}`}
                      >
                        {row.note ?? ""}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td
                      className={`${tableBorderClass(config.tableBorder)} p-2 ${tablePaddingClass(config.tableRowSpacing)}`}
                    >
                      รวมทั้งสิ้น
                    </td>
                    {[
                      totals.cash,
                      totals.bank,
                      totals.government,
                      totals.cash + totals.bank + totals.government,
                    ].map((value, i) => (
                      <td
                        key={i}
                        className={`${tableBorderClass(config.tableBorder)} p-2 text-right tabular-nums ${tablePaddingClass(config.tableRowSpacing)}`}
                      >
                        {money(value)}
                      </td>
                    ))}
                    <td
                      className={`${tableBorderClass(config.tableBorder)} p-2 ${tablePaddingClass(config.tableRowSpacing)}`}
                    />
                  </tr>
                </tbody>
              </table>
              <div className="mt-8 space-y-1 text-lg print:mt-4 print:space-y-0 print:text-[11pt] print:leading-tight">
                <div className="ml-auto w-1/2 min-w-64 text-center">
                  <p>
                    ลงชื่อ.............................................ผู้จัดทำรายงาน
                  </p>
                  <p>{signer(config.makerName)}</p>
                  <p>
                    ตำแหน่ง{" "}
                    {config.makerPosition ||
                      "............................................."}
                  </p>
                </div>
                <p className="pt-6 print:pt-3">{config.committeeStatement}</p>
                <div className="grid grid-cols-3 gap-4 pt-8 text-center print:pt-4">
                  {config.committeeNames.map((name, index) => (
                    <p key={index}>
                      ลงชื่อ.............................................
                      <br />
                      {name ? `(${name}) ` : ""}
                      {config.committeePositions[index]}
                    </p>
                  ))}
                </div>
                <div className="ml-auto w-1/2 min-w-64 pt-8 text-center print:pt-4">
                  <p>
                    ลงชื่อ.............................................หัวหน้าหน่วยงาน
                  </p>
                  <p>{signer(config.headName)}</p>
                  <p>
                    ตำแหน่ง{" "}
                    {config.headPosition ||
                      "............................................."}
                  </p>
                </div>
                <div
                  className={`grid grid-cols-2 items-baseline gap-4 pt-8 print:pt-3 ${config.showDivider ? "border-t border-black" : ""}`}
                >
                  <p>{config.receiptStatement}</p>
                  <p className="pl-5 text-left print:pl-5">{receiptDate}</p>
                </div>
                <div className="ml-auto mr-8 w-1/2 min-w-64 pt-4 text-center print:pt-2">
                  <p>
                    ลงชื่อ{" "}
                    {config.receiptName ||
                      "............................................."}{" "}
                    {config.receiptPosition}
                  </p>
                  <p className="pt-4 print:pt-2">
                    ลงชื่อ{" "}
                    {config.subheadName ||
                      "............................................."}{" "}
                    {config.subheadPosition}
                  </p>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
