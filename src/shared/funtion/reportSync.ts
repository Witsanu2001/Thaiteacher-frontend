import type { BalanceRow, DailyReport } from "./types";

function rowValues(rows: BalanceRow[]) {
  return rows.map(row => ({
    name: row.name,
    cash: row.cash,
    bank: row.bank,
    government: row.government,
    note: row.note || "",
    level: row.level || 0,
    group: Boolean(row.group),
  }));
}

export function sameReportRows(left: BalanceRow[], right: BalanceRow[]) {
  return JSON.stringify(rowValues(left)) === JSON.stringify(rowValues(right));
}

export function mergeBudgetReports(local: DailyReport[], remote: DailyReport[]) {
  const remoteByDate = new Map(remote.map(report => [report.date, report]));
  const localOnly = local.filter(report => !remoteByDate.has(report.date));
  const conflicts = local.filter(report => {
    const server = remoteByDate.get(report.date);
    return server && !sameReportRows(report.rows, server.rows);
  });
  return {
    reports: [...localOnly, ...remote].sort((a, b) => a.date.localeCompare(b.date)),
    localOnly,
    conflicts,
  };
}
