import * as XLSX from "xlsx";
import { newId, type SchoolProject } from "./projectModel";

const clean = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const amount = (value: unknown) => {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export async function readProjectWorkbook(file: File, fiscalYear: number): Promise<SchoolProject[]> {
  if (file.size > 5 * 1024 * 1024) throw new Error("ไฟล์ Excel ต้องไม่เกิน 5 MB");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets["โครงการ"] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("ไม่พบตารางโครงการในไฟล์");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rows.length > 5000) throw new Error("ไฟล์มีแถวมากเกินไป");
  const headerIndex = rows.findIndex((row) => row.some((cell) => /โครงการ|ชื่อโครงการ|แผนงาน/.test(clean(cell))) && row.some((cell) => /เงิน|งบ|รวม|ผู้รับผิดชอบ|หมายเหตุ/.test(clean(cell))));
  const headers = headerIndex >= 0 ? rows[headerIndex].map(clean) : [];
  const nameColumn = Math.max(0, headers.findIndex((cell) => /ชื่อโครงการ|แผนงาน\/โครงการ|^โครงการ$/.test(cell)));
  const ownerColumn = headers.findIndex((cell) => /ผู้รับผิดชอบ|หมายเหตุ/.test(cell));
  const departmentColumn = headers.findIndex((cell) => /ฝ่าย|กลุ่มงาน/.test(cell));
  const budgetColumns = headers.map((cell, index) => /เงินอุดหนุน|กิจกรรมพัฒนา|เรียนฟรี|รายได้สถานศึกษา|อื่น|งบประมาณ|วงเงิน/.test(cell) ? index : -1).filter((index) => index >= 0);
  const allocationsFromRow = (row: unknown[]) => budgetColumns.flatMap((index) => {
    const budget = amount(row[index]);
    return budget ? [{ id: newId(), category: "", budget, sourceLabel: headers[index] }] : [];
  });
  let department = "ไม่ระบุฝ่าย";
  const result: SchoolProject[] = [];
  const start = headerIndex >= 0 ? headerIndex + 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const rawName = clean(row[nameColumn]);
    if (!rawName) continue;
    if (/^ฝ่าย/.test(rawName) && !/โครงการ/.test(rawName)) { department = rawName; continue; }
    if (/^รวม|^เงินคงเหลือ|^งบที่ได้รับ/.test(rawName) || /^[-–]/.test(rawName)) continue;
    const numbered = /^\d+\s*[.)]+\s*/.test(rawName);
    if (!numbered && !/โครงการ/.test(rawName)) continue;
    const name = rawName.replace(/^\d+\s*[.)]+\s*/, "");
    if (!name || name === "โครงการ") continue;
    const activities: SchoolProject["activities"] = [];
    for (let j = i + 1; j < Math.min(rows.length, i + 30); j++) {
      const label = clean(rows[j][nameColumn]);
      if (/^รวม/.test(label) || /^ฝ่าย/.test(label) || /^\d+\s*[.)]+\s*/.test(label)) break;
      if (!label) continue;
      const allocations = allocationsFromRow(rows[j]);
      if (/^[-–]/.test(label) || allocations.length) activities.push({ id: newId(), name: label.replace(/^[-–]\s*/, ""), allocations });
    }
    if (!activities.length) {
      const allocations = allocationsFromRow(row);
      if (allocations.length) activities.push({ id: newId(), name: "กิจกรรมหลัก", allocations });
    }
    result.push({ id: newId(), fiscalYear, name, department: departmentColumn >= 0 ? clean(row[departmentColumn]) || department : department, owner: ownerColumn >= 0 ? clean(row[ownerColumn]) : "", activities });
  }
  if (!result.length) throw new Error("ไม่พบชื่อโครงการ กรุณาตรวจว่าแถวโครงการมีชื่อหรือเลขลำดับ");
  return result;
}
