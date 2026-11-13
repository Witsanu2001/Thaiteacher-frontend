import type { DailyReport, FinanceSchool } from "../../shared/funtion/types";
import { scopedStorage, setStorageUser, configureStorageSync } from "../../shared/funtion/scopedStorage";
import { projectRemark } from "../../shared/funtion/projectRemark";

const demoUserId = "public-demo";
export const demoSchoolName = "โรงเรียนตัวอย่าง";
const sample: FinanceSchool[] = [{ name: demoSchoolName, reports: [{
  date: "2026-11-08",
  rows: [
    { name: "เงินงบประมาณ", level: 0, group: true, cash: 0, bank: 0, government: 0, note: "" },
    { name: "เงินรายได้แผ่นดิน", level: 0, cash: 0, bank: 0, government: 0, note: "" },
    { name: "เงินนอกงบประมาณ", level: 0, group: true, cash: 0, bank: 0, government: 0, note: "" },
    { name: "เงินอุดหนุนค่าใช้จ่ายรายหัว", level: 1, cash: 0, bank: 4910.97, government: 0, note: "" },
    { name: "เงินอุดหนุนเรียนฟรี 15 ปี", level: 1, group: true, cash: 0, bank: 0, government: 0, note: "" },
    { name: "ค่าอุปกรณ์การเรียน", level: 2, cash: 0, bank: 12500, government: 0, note: "" },
    { name: "ค่าเครื่องแบบนักเรียน", level: 2, cash: 0, bank: 8400, government: 0, note: "" },
    { name: "ค่าหนังสือแบบเรียน", level: 2, cash: 0, bank: 13200, government: 0, note: "" },
    { name: "ค่ากิจกรรมพัฒนาผู้เรียน", level: 2, cash: 0, bank: 18465.57, government: 0, note: "" },
    { name: "เงินอุดหนุนโครงการอาหารกลางวัน", level: 1, cash: 0, bank: 68569.2, government: 0, note: "" },
    { name: "เงินรายได้สถานศึกษา", level: 1, cash: 11373, bank: 9393.79, government: 0, note: "ตัวอย่าง" },
  ],
}] }];

function readDemoSchools(): FinanceSchool[] {
  try {
    const value: unknown = JSON.parse(scopedStorage.getItem("school-finances-v2") || "[]");
    return Array.isArray(value) ? value as FinanceSchool[] : [];
  } catch {
    return [];
  }
}

export function enterDemoScope() {
  setStorageUser(demoUserId);
  configureStorageSync(null);
  if (!readDemoSchools().length) scopedStorage.setItem("school-finances-v2", JSON.stringify(sample));
}

export function loadDemoReports(): DailyReport[] {
  const schools = readDemoSchools();
  return (schools.find(school => school.name === demoSchoolName)?.reports || []).map(report => ({ ...report, rows: report.rows.map(row => ({ ...row, note: projectRemark(row.note || "") })) }));
}

export function saveDemoReports(reports: DailyReport[]) {
  const schools = readDemoSchools();
  const index = schools.findIndex(school => school.name === demoSchoolName);
  const school = index >= 0 ? schools[index] : { name: demoSchoolName, reports: [] };
  const byDate = new Map(school.reports.map(report => [report.date, report]));
  for (const report of reports) byDate.set(report.date, report);
  const updated = { ...school, reports: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  scopedStorage.setItem("school-finances-v2", JSON.stringify(index >= 0 ? schools.map((item, i) => i === index ? updated : item) : [...schools, updated]));
}
