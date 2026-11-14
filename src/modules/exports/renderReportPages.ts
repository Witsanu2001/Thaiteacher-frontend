import { blockDateText, defaultTableHeaders, signatureText, type ReportBlock, type ReportLayout } from "../../shared/funtion/reportPageLayout";
import { receiptDateText, type ExportFormConfig } from "../../shared/funtion/exportFormConfig";
import type { BalanceRow } from "../../shared/funtion/types";
import { money } from "../../shared/funtion/money";

const MM = 96 / 25.4;
const PT = 96 / 72;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const MARGIN_X = 15 * MM;
const MARGIN_TOP = 16 * MM;
const MARGIN_BOTTOM = 12 * MM;
const FONT = '"TH Sarabun PSK"';
type PaintedBlock = { height: number; paint: (x: number, y: number) => void };
export type ReportPageImage = { image: string; scale: number };

/** Convert the original form into the same rows used by custom report layouts. */
export function originalReportLayout(school: string, date: string, config: ExportFormConfig): ReportLayout {
  let id = 0;
  const text = (value: string, align: ReportBlock["align"] = "left", bold = false, fontSize = 11): ReportBlock => ({ id: `original-${id++}`, type: "text", text: value, align, bold, fontSize });
  const signature = (value: string): ReportBlock => ({ ...text(value, "center"), type: "signature" });
  const row = (...blocks: (ReportBlock | null)[]) => ({ id: `original-row-${id++}`, columns: blocks.length as 1 | 2 | 3, blocks });
  const name = (value: string) => `(${value.trim() || "............................................."})`;
  const titleDate: ReportBlock = { id: "original-date", type: "date", align: "center", fontSize: 12, text: "ประจำวันที่ {วัน} เดือน {เดือน} พ.ศ. {ปี}" };
  return { pages: [{ id: "original-page", rows: [
    row(text(config.schoolDisplayName.trim() || school, "center", true, 12)),
    row(text(config.reportTitle, "center", true, 12)),
    row(titleDate), row(null),
    row({ id: "original-table", type: "table", tableFontSize: config.tableFontSize === "compact" ? 10 : config.tableFontSize === "large" ? 12 : 11, tableHeaderFontSize: 10, tableHeaderColor: config.shadeHeader ? "gray" : "white" }),
    row(null),
    row(null, signature(`ลงชื่อ.............................................ผู้จัดทำรายงาน\n${name(config.makerName)}\nตำแหน่ง ${config.makerPosition || "............................................."}`)),
    row(null), row(text(config.committeeStatement)),
    row(...config.committeeNames.map((value, i) => signature(`ลงชื่อ.............................................\n${value ? name(value) + "\n" : ""}${config.committeePositions[i]}`))),
    row(null),
    row(null, signature(`ลงชื่อ.............................................หัวหน้าหน่วยงาน\n${name(config.headName)}\nตำแหน่ง ${config.headPosition || "............................................."}`)),
    ...(config.showDivider ? [row({ id: "original-divider", type: "divider" } as ReportBlock)] : []),
    row(text(config.receiptStatement), text(receiptDateText(config, date))),
    row(null, signature(`ลงชื่อ ${config.receiptName || "............................................."} ${config.receiptPosition}\nลงชื่อ ${config.subheadName || "............................................."} ${config.subheadPosition}`)),
  ] }] };
}

// Draw text with the loaded font rather than SVG foreignObject screenshots.
// Safari can omit fonts or truncate transformed HTML in those screenshots.
export async function renderReportPages(layout: ReportLayout, date: string, rows: BalanceRow[]): Promise<ReportPageImage[]> {
  await Promise.all([
    document.fonts.load(`400 12pt ${FONT}`, "รายงานเงินคงเหลือ 0123456789"),
    document.fonts.load(`700 12pt ${FONT}`, "รายงานเงินคงเหลือ 0123456789"),
  ]);
  if (!document.fonts.check(`400 12pt ${FONT}`) || !document.fonts.check(`700 12pt ${FONT}`)) throw new Error("report_font_unavailable");
  const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
  const words = new Intl.Segmenter("th", { granularity: "word" });
  const result: ReportPageImage[] = [];
  for (const page of layout.pages) {
    const canvas = document.createElement("canvas");
    const ratio = 3;
    canvas.width = Math.round(PAGE_WIDTH * ratio);
    canvas.height = Math.round(PAGE_HEIGHT * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("report_canvas_unavailable");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    const setFont = (size: number, bold = false, italic = false) => { ctx.font = `${italic ? "italic " : ""}${bold ? 700 : 400} ${size * PT}px ${FONT}`; };
    const wrap = (text: string, width: number) => {
      const lines: string[] = [];
      for (const paragraph of text.replaceAll("\t", "    ").split("\n")) {
        let line = "";
        for (const { segment } of words.segment(paragraph)) {
          if (ctx.measureText(line + segment).width <= width) { line += segment; continue; }
          if (line) { lines.push(line.trimEnd()); line = ""; }
          if (ctx.measureText(segment).width <= width) { line = segment.trimStart(); continue; }
          for (const { segment: glyph } of graphemes.segment(segment)) {
            if (line && ctx.measureText(line + glyph).width > width) { lines.push(line); line = ""; }
            line += glyph;
          }
        }
        lines.push(line);
      }
      return lines;
    };
    const paintLines = (lines: string[], x: number, y: number, width: number, size: number, align: ReportBlock["align"] = "left", bold = false, italic = false, underline = false) => {
      setFont(size, bold, italic);
      ctx.fillStyle = "#000";
      ctx.textAlign = align || "left";
      const lineHeight = size * PT * 1.2;
      lines.forEach((line, index) => {
        const metrics = ctx.measureText(line || "ก");
        const baseline = y + index * lineHeight + (lineHeight + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
        const anchor = align === "center" ? x + width / 2 : align === "right" ? x + width : x;
        ctx.fillText(line, anchor, baseline);
        if (underline && line) {
          const start = align === "center" ? anchor - metrics.width / 2 : align === "right" ? anchor - metrics.width : anchor;
          ctx.beginPath(); ctx.lineWidth = 0.6; ctx.strokeStyle = "#000"; ctx.moveTo(start, baseline + 1); ctx.lineTo(start + metrics.width, baseline + 1); ctx.stroke();
        }
      });
    };
    const measureBlock = (block: ReportBlock | null, width: number): PaintedBlock => {
      if (!block) return { height: 12, paint: () => {} };
      if (block.type === "divider") return { height: 9, paint: (x, y) => { ctx.beginPath(); ctx.lineWidth = 0.6; ctx.strokeStyle = "#000"; ctx.moveTo(x, y + 4); ctx.lineTo(x + width, y + 4); ctx.stroke(); } };
      if (block.type !== "table") {
        const size = block.fontSize || 12;
        const bold = block.bold !== false;
        setFont(size, bold, block.italic);
        const value = block.type === "date" ? blockDateText(block, date) : block.type === "signature" ? signatureText(block) : block.text || "";
        const lines = wrap(value, width);
        const top = block.type === "signature" ? 5 : 0;
        return { height: lines.length * size * PT * 1.2 + top, paint: (x, y) => paintLines(lines, x, y + top, width, size, block.align, bold, block.italic, block.underline) };
      }
      const size = block.tableFontSize || 10;
      const headerSize = block.tableHeaderFontSize || 10;
      const widths = [32, 12, 15, 16, 13, 12].map(value => width * value / 100);
      const totals = rows.reduce((sum, item) => ({ cash: sum.cash + (item.group ? 0 : item.cash), bank: sum.bank + (item.group ? 0 : item.bank), government: sum.government + (item.group ? 0 : item.government) }), { cash: 0, bank: 0, government: 0 });
      const tableRows = [
        { values: defaultTableHeaders.map((value, i) => block.tableHeaders?.[i] ?? value), header: true, bold: block.tableHeaderBold !== false, indent: 0 },
        ...rows.map(item => ({ values: [`${item.level ? "- " : ""}${item.name}`, ...[item.cash, item.bank, item.government, item.cash + item.bank + item.government].map(value => item.group ? "" : money(value)), item.note || ""], header: false, bold: Boolean(item.group), indent: (item.level || 0) * 8 })),
        { values: ["รวมทั้งสิ้น", money(totals.cash), money(totals.bank), money(totals.government), money(totals.cash + totals.bank + totals.government), ""], header: false, bold: true, indent: 0 },
      ].map(item => {
        const cells = item.values.map((value, index) => {
          let fontSize = item.header ? headerSize : size;
          const padding = 4 + (index === 0 ? item.indent : 0);
          setFont(fontSize, item.bold);
          if (!item.header && index > 0 && index < 5) {
            const measured = ctx.measureText(value).width;
            if (measured > widths[index] - padding - 4) fontSize *= (widths[index] - padding - 4) / measured;
            return { lines: [value], fontSize, padding };
          }
          return { lines: wrap(value, widths[index] - padding - 4), fontSize, padding };
        });
        return { ...item, cells, height: Math.max(...cells.map(cell => cell.lines.length * cell.fontSize * PT * 1.2)) + 6 };
      });
      return { height: tableRows.reduce((sum, item) => sum + item.height, 0), paint: (x, y) => {
        let top = y;
        for (const item of tableRows) {
          let left = x;
          item.cells.forEach((cell, index) => {
            if (item.header && block.tableHeaderColor && block.tableHeaderColor !== "white") {
              ctx.fillStyle = block.tableHeaderColor === "blue" ? "#dbeafe" : "#e5e7eb";
              ctx.fillRect(left, top, widths[index], item.height);
            }
            ctx.strokeStyle = "#000"; ctx.lineWidth = 0.6; ctx.strokeRect(left, top, widths[index], item.height);
            const lineHeight = cell.fontSize * PT * 1.2;
            paintLines(cell.lines, left + cell.padding, top + (item.height - cell.lines.length * lineHeight) / 2, widths[index] - cell.padding - 4, cell.fontSize, item.header ? block.tableHeaderAlign || "center" : index > 0 && index < 5 ? "right" : "left", item.bold);
            left += widths[index];
          });
          top += item.height;
        }
      } };
    };
    const contentWidth = PAGE_WIDTH - MARGIN_X * 2;
    const gap = 4;
    const measuredRows = page.rows.flatMap(row => {
      const groups: { blocks: (ReportBlock | null)[]; columns: number }[] = [];
      let cells: (ReportBlock | null)[] = [];
      const flush = () => {
        if (!cells.length) return;
        groups.push({ blocks: cells, columns: row.columns });
        cells = [];
      };
      for (const block of row.blocks) {
        if (block?.type === "table") {
          flush();
          groups.push({ blocks: [block], columns: 1 });
        } else cells.push(block);
      }
      flush();
      return groups.map(group => {
        const blockWidth = (contentWidth - gap * (group.columns - 1)) / group.columns;
        const measured = group.blocks.map(block => measureBlock(block, blockWidth));
        return { measured, blockWidth, height: Math.max(0, ...measured.map(block => block.height)) };
      });
    });
    const naturalHeight = measuredRows.reduce((sum, row) => sum + row.height, 0);
    const scale = Math.min(1, (PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM) / Math.max(1, naturalHeight));
    ctx.save();
    ctx.translate(MARGIN_X + contentWidth * (1 - scale) / 2, MARGIN_TOP);
    ctx.scale(scale, scale);
    let top = 0;
    for (const row of measuredRows) {
      row.measured.forEach((block, index) => block.paint(index * (row.blockWidth + gap), top));
      top += row.height;
    }
    ctx.restore();
    result.push({ image: canvas.toDataURL("image/png"), scale });
    canvas.width = canvas.height = 1;
  }
  return result;
}
