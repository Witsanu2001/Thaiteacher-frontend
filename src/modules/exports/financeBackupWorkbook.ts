import * as XLSX from "xlsx";
import type { CashbookEntry, DailyReport } from "../../shared/funtion/types";
import { fiscalYearOf } from "../../shared/funtion/fiscalYear";

export type BackupVoucher = { number: string; party: string; purpose: string; note: string };
export type FinanceBackup = {
  school: string;
  from: string;
  to: string;
  createdAt: string;
  reports: DailyReport[];
  entries: CashbookEntry[];
  vouchers: Record<string, BackupVoucher>;
  opening: Record<string, number>;
};

const marker = "THAITEACHER_FINANCE_BACKUP_V1";
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const amount = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e12 || Math.abs(Math.round(number * 100) - number * 100) > 0.0001) throw new Error("พบจำนวนเงินไม่ถูกต้องในไฟล์");
  return number;
};
const str = (value: unknown) => String(value ?? "").trim();
const rows = (book: XLSX.WorkBook, name: string): unknown[][] => {
  const sheet = book.Sheets[name];
  if (!sheet) throw new Error(`ไม่พบชีต ${name}`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
};

export function buildFinanceBackup(data: FinanceBackup): ArrayBuffer {
  const book = XLSX.utils.book_new();
  const add = (name: string, values: unknown[][]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(values), name);
  add("ข้อมูลสำรอง", [["รูปแบบ", marker], ["โรงเรียน", data.school], ["ตั้งแต่", data.from], ["ถึง", data.to], ["สร้างเมื่อ", data.createdAt], ["หมายเหตุ", "ไฟล์แนบไม่ได้รวมใน Excel ต้องสำรองแยก"]]);
  add("ยอดรายวัน", [["วันที่", "ลำดับ", "ประเภทเงิน", "เงินสด", "เงินฝากธนาคาร", "เงินฝากส่วนราชการผู้เบิก", "หมายเหตุ", "ระดับ", "หัวข้อ"], ...data.reports.flatMap(report => report.rows.map((row, index) => [report.date, index + 1, row.name, row.cash, row.bank, row.government, row.note || "", row.level || 0, row.group ? 1 : 0]))]);
  add("รายรับรายจ่าย", [["รหัสรายการ", "วันที่", "รับหรือจ่าย", "ประเภทเงิน", "ช่องทาง", "เลขที่เอกสาร", "รายการ", "จำนวนเงิน", "รับจากหรือจ่ายให้", "หมายเหตุ"], ...data.entries.map(entry => [entry.id, entry.date, entry.kind, entry.category, entry.account, entry.documentNo, entry.description, entry.amount, entry.party, entry.note])]);
  add("ใบสำคัญ", [["รหัสรายการ", "เลขที่ใบสำคัญ", "ชื่อผู้เกี่ยวข้อง", "รายการ", "หมายเหตุ"], ...Object.entries(data.vouchers).map(([id, voucher]) => [id, voucher.number, voucher.party, voucher.purpose, voucher.note])]);
  add("ยอดยกมา", [["ปีงบประมาณ", "ประเภทเงิน", "จำนวนเงิน"], ...Object.entries(data.opening).map(([key, value]) => { const split = key.indexOf(":"); return [key.slice(0, split), key.slice(split + 1), value]; })]);
  return XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
}

export async function parseFinanceBackup(file: File): Promise<FinanceBackup> {
  if (file.size > 20 * 1024 * 1024) throw new Error("ไฟล์สำรองต้องไม่เกิน 20 MB");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellFormula: false });
  const meta = rows(book, "ข้อมูลสำรอง");
  if (str(meta[0]?.[1]) !== marker) throw new Error("ไฟล์นี้ไม่ใช่ไฟล์สำรอง ThaiTeacher");
  const school = str(meta[1]?.[1]), from = str(meta[2]?.[1]), to = str(meta[3]?.[1]);
  if (!school || !validDate(from) || !validDate(to) || from > to) throw new Error("ข้อมูลโรงเรียนหรือช่วงวันที่ในไฟล์ไม่ถูกต้อง");
  const within = (date: string) => validDate(date) && date >= from && date <= to;
  const reportMap = new Map<string, { order: number; row: DailyReport["rows"][number] }[]>();
  const reportRows = rows(book, "ยอดรายวัน");
  const entryRows = rows(book, "รายรับรายจ่าย");
  if (reportRows.length > 100_000 || entryRows.length > 100_000) throw new Error("ไฟล์มีรายการมากเกินไป");
  for (const value of reportRows.slice(1)) {
    if (!value.some(cell => str(cell))) continue;
    const date = str(value[0]), order = Number(value[1]), name = str(value[2]);
    if (!within(date) || !Number.isInteger(order) || order < 1 || !name || name.length > 250) throw new Error("พบแถวยอดรายวันที่ไม่ถูกต้อง");
    const level = Number(value[7] || 0);
    if (!Number.isInteger(level) || level < 0 || level > 5) throw new Error("ระดับหัวข้อไม่ถูกต้อง");
    const group = Number(value[8] || 0);
    if (group !== 0 && group !== 1) throw new Error("ชนิดหัวข้อไม่ถูกต้อง");
    const list = reportMap.get(date) || [];
    list.push({ order, row: { name, cash: amount(value[3]), bank: amount(value[4]), government: amount(value[5]), note: str(value[6]), level, group: group === 1 } });
    reportMap.set(date, list);
  }
  const reports = [...reportMap.entries()].map(([date, list]) => {
    list.sort((a, b) => a.order - b.order);
    if (list.length > 300 || list.some((item, index) => item.order !== index + 1)) throw new Error(`ลำดับรายการวันที่ ${date} ไม่ถูกต้อง`);
    return { date, rows: list.map(item => item.row) };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const entries: CashbookEntry[] = [];
  const entryIds = new Set<string>();
  for (const value of entryRows.slice(1)) {
    if (!value.some(cell => str(cell))) continue;
    const id = str(value[0]), date = str(value[1]), kind = str(value[2]), account = str(value[4]);
    if (!id || entryIds.has(id) || !within(date) || !["income", "expense"].includes(kind) || !["cash", "bank", "government"].includes(account) || !str(value[3]) || !str(value[6])) throw new Error("พบรายการรับ–จ่ายที่ไม่ถูกต้องหรือรหัสซ้ำ");
    entryIds.add(id);
    const entryAmount = amount(value[7]);
    if (entryAmount <= 0) throw new Error("จำนวนเงินรับ–จ่ายต้องมากกว่า 0");
    entries.push({ id, date, kind: kind as CashbookEntry["kind"], category: str(value[3]), account: account as CashbookEntry["account"], documentNo: str(value[5]), description: str(value[6]), amount: entryAmount, party: str(value[8]), note: str(value[9]) });
  }
  const vouchers: Record<string, BackupVoucher> = {};
  for (const value of rows(book, "ใบสำคัญ").slice(1)) {
    if (!value.some(cell => str(cell))) continue;
    const id = str(value[0]);
    if (!entryIds.has(id) || vouchers[id]) throw new Error("ใบสำคัญไม่ตรงกับรายการรับ–จ่ายในไฟล์");
    vouchers[id] = { number: str(value[1]), party: str(value[2]), purpose: str(value[3]), note: str(value[4]) };
  }
  const opening: Record<string, number> = {};
  const years = new Set<number>();
  for (let year = fiscalYearOf(from); year <= fiscalYearOf(to); year++) years.add(year);
  for (const value of rows(book, "ยอดยกมา").slice(1)) {
    if (!value.some(cell => str(cell))) continue;
    const year = Number(value[0]), category = str(value[1]);
    if (!Number.isInteger(year) || !years.has(year) || !category) throw new Error("ยอดยกมาไม่ตรงกับช่วงข้อมูลในไฟล์");
    opening[`${year}:${category}`] = amount(value[2]);
  }
  return { school, from, to, createdAt: str(meta[4]?.[1]), reports, entries, vouchers, opening };
}
