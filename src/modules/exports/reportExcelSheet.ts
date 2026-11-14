import type ExcelJS from "exceljs";
import type { BalanceRow } from "../../shared/funtion/types";
import { blockDateText, defaultTableHeaders, signatureLines, type ReportLayout } from "../../shared/funtion/reportPageLayout";

/** Add the same printable report sheet used by the report preview export. */
export function appendReportSheets(book: ExcelJS.Workbook, layout: ReportLayout, date: string, rows: BalanceRow[], prefix = "หน้า") {
  const totals = rows.reduce((sum, row) => ({
    cash: sum.cash + (row.group ? 0 : row.cash),
    bank: sum.bank + (row.group ? 0 : row.bank),
    government: sum.government + (row.group ? 0 : row.government),
  }), { cash: 0, bank: 0, government: 0 });
  layout.pages.forEach((page, index) => {
    const sheet = book.addWorksheet(`${prefix} ${index + 1}`, {
      pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    });
    sheet.columns = [{ width: 43 }, { width: 13 }, { width: 17 }, { width: 18 }, { width: 13 }, { width: 20 }];
    page.rows.forEach((layoutRow) => {
      if (layoutRow.blocks.every((block) => !block)) { sheet.addRow([]).height = 18; return; }
      const contentRow = layoutRow.blocks.some((block) => block?.type === "table") ? null : sheet.addRow([]);
      layoutRow.blocks.forEach((block, slot) => {
        if (!block) return;
        const start = layoutRow.columns === 1 ? 1 : layoutRow.columns === 2 ? slot * 3 + 1 : slot * 2 + 1;
        const end = layoutRow.columns === 1 ? 6 : layoutRow.columns === 2 ? start + 2 : start + 1;
        if (block.type === "table") {
          const head = sheet.addRow(defaultTableHeaders.map((label, i) => block.tableHeaders?.[i] ?? label));
          head.height = Math.max(27, ...defaultTableHeaders.map((label, i) => (block.tableHeaders?.[i] ?? label).split("\n").length * (block.tableHeaderFontSize || 10) * 1.7));
          head.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: "TH Sarabun PSK", size: block.tableHeaderFontSize || 10, bold: block.tableHeaderBold !== false };
            cell.alignment = { horizontal: block.tableHeaderAlign || "center", vertical: "middle", wrapText: true };
            cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
            if (block.tableHeaderColor !== "white") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: block.tableHeaderColor === "blue" ? "FFDBEAFE" : "FFE5E7EB" } };
          });
          [...rows, { name: "รวมทั้งสิ้น", cash: totals.cash, bank: totals.bank, government: totals.government, note: "", group: false }].forEach((r) => {
            const rr = sheet.addRow([r.name, r.group ? "" : r.cash, r.group ? "" : r.bank, r.group ? "" : r.government, r.group ? "" : r.cash + r.bank + r.government, r.note || ""]);
            rr.height = Math.max(22, (block.tableFontSize || 10) * 1.6);
            rr.font = { name: "TH Sarabun PSK", size: block.tableFontSize || 10, bold: true };
            rr.eachCell({ includeEmpty: true }, (c) => {
              c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
              if (typeof c.value === "number") c.numFmt = "#,##0.00";
            });
          });
          return;
        }
        const value = block.type === "date" ? blockDateText(block, date) : block.type === "signature" ? signatureLines(block).join("\n") : block.type === "divider" ? "________________________________________" : block.text || "";
        const r = contentRow ?? sheet.addRow([]);
        r.getCell(start).value = value;
        if (end > start) sheet.mergeCells(r.number, start, r.number, end);
        r.font = { name: "TH Sarabun PSK", size: block.fontSize || 12, bold: block.bold !== false, italic: block.italic === true, underline: block.underline === true };
        r.getCell(start).alignment = { vertical: "middle", wrapText: true, horizontal: block.align || "left" };
        r.height = block.type === "signature" ? Math.max(25, signatureLines(block).length * (block.fontSize || 12) * 1.4) : Math.max(25, (block.fontSize || 12) * 1.5);
      });
    });
    sheet.pageSetup.printArea = `A1:F${Math.max(1, sheet.rowCount)}`;
  });
}
