import { AlignmentType, BorderStyle, Document, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { BalanceRow } from "../../shared/funtion/types";
import type { ExportFormConfig } from "../../shared/funtion/exportFormConfig";
import { receiptDateText } from "../../shared/funtion/exportFormConfig";
import { blockDateText, defaultTableHeaders, signatureText, type ReportBlock, type ReportLayout } from "../../shared/funtion/reportPageLayout";
import { money } from "../../shared/funtion/money";

type Input = { school: string; date: string; rows: BalanceRow[]; layout: ReportLayout | null; config: ExportFormConfig };
const font = "TH Sarabun PSK";
const alignment = (value?: ReportBlock["align"]) => value === "center" ? AlignmentType.CENTER : value === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
const paragraph = (value: string, block?: ReportBlock) => new Paragraph({
  alignment: alignment(block?.align),
  spacing: { after: 0, line: 240 },
  children: value.split("\n").flatMap((line, index) => [new TextRun({ text: line || " ", break: index ? 1 : 0, font, size: (block?.fontSize || 12) * 2, bold: block?.bold !== false, italics: block?.italic || false, underline: block?.underline ? {} : undefined })]),
});
const cell = (value: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, font, size: 20, bold })], spacing: { after: 0 } })] });
const table = (headers: string[], rows: BalanceRow[]) => {
  const totals = rows.reduce((sum, row) => ({ cash: sum.cash + (row.group ? 0 : row.cash), bank: sum.bank + (row.group ? 0 : row.bank), government: sum.government + (row.group ? 0 : row.government) }), { cash: 0, bank: 0, government: 0 });
  const values = rows.map((row) => [row.name, row.group ? "" : money(row.cash), row.group ? "" : money(row.bank), row.group ? "" : money(row.government), row.group ? "" : money(row.cash + row.bank + row.government), row.note || ""]);
  values.push(["รวมทั้งสิ้น", money(totals.cash), money(totals.bank), money(totals.government), money(totals.cash + totals.bank + totals.government), ""]);
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: headers.map((heading) => cell(heading, true)) }), ...values.map((value, index) => new TableRow({ children: value.map((text) => cell(text, index === values.length - 1)) }))] });
};
const blockElements = (block: ReportBlock, date: string, rows: BalanceRow[]): (Paragraph | Table)[] => {
  if (block.type === "table") return [table(defaultTableHeaders.map((heading, index) => block.tableHeaders?.[index] ?? heading), rows)];
  if (block.type === "divider") return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } }, spacing: { after: 0 } })];
  const value = block.type === "date" ? blockDateText(block, date) : block.type === "signature" ? signatureText(block) : block.text || "";
  return [paragraph(value, block)];
};

export async function buildReportWord({ school, date, rows, layout, config }: Input): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  if (layout) {
    layout.pages.forEach((page, pageIndex) => {
      if (pageIndex) children.push(new Paragraph({ children: [new PageBreak()] }));
      page.rows.forEach((row) => {
        if (row.blocks.every((block) => !block)) { children.push(paragraph(" ")); return; }
        if (row.columns === 1 || row.blocks.some((block) => block?.type === "table")) {
          row.blocks.forEach((block) => { if (block) children.push(...blockElements(block, date, rows)); });
          return;
        }
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ children: row.blocks.map((block) => new TableCell({ children: block ? blockElements(block, date, rows) : [paragraph(" ")] })) })] }));
      });
    });
  } else {
    const [year, month, day] = date.split("-").map(Number);
    const thaiMonth = new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(year, month - 1, 1));
    const centered: ReportBlock = { id: "", type: "text", align: "center", fontSize: 12 };
    children.push(paragraph(school, centered), paragraph(config.reportTitle, centered), paragraph(`ประจำวันที่ ${day} เดือน ${thaiMonth} พ.ศ. ${year + 543}`, centered));
    children.push(table(defaultTableHeaders, rows));
    children.push(paragraph(`ลงชื่อ............................................. ผู้จัดทำรายงาน\n(${config.makerName || "............................................."})\nตำแหน่ง ${config.makerPosition || "............................................."}`, { id: "", type: "signature", align: "right" }));
    children.push(paragraph(config.committeeStatement));
    config.committeeNames.forEach((name, index) => children.push(paragraph(`ลงชื่อ............................................. ${config.committeePositions[index]}\n(${name || "............................................."})`)));
    children.push(paragraph(`ลงชื่อ............................................. หัวหน้าหน่วยงาน\n(${config.headName || "............................................."})\nตำแหน่ง ${config.headPosition || "............................................."}`, { id: "", type: "signature", align: "right" }));
    if (config.showDivider) children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" } } }));
    children.push(paragraph(`${config.receiptStatement}     ${receiptDateText(config, date)}`));
    children.push(paragraph(`ลงชื่อ ${config.receiptName || "............................................."} ${config.receiptPosition}\nลงชื่อ ${config.subheadName || "............................................."} ${config.subheadPosition}`, { id: "", type: "signature", align: "right" }));
  }
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 850, bottom: 600, left: 850, right: 850 } } }, children }] });
  return Packer.toBlob(document);
}
