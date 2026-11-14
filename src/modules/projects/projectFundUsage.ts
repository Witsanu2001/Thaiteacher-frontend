import type { DailyReport } from "../../shared/funtion/types";

type Expense = { category: string; date: string; amount: number };

/** Daily reports already include project deductions; do not subtract them again. */
export function projectFundUsage(reports: DailyReport[], categories: string[], expenses: Expense[]) {
  const latestReport = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0];
  const spentByCategory = new Map<string, number>();
  for (const entry of expenses) {
    if (!latestReport || entry.date > latestReport.date) continue;
    spentByCategory.set(entry.category, (spentByCategory.get(entry.category) || 0) + Math.round(entry.amount * 100));
  }
  const usage = [...new Set([...categories, ...expenses.map(entry => entry.category)])].filter(Boolean).map(category => {
    const reportRows = latestReport?.rows.filter(row => !row.group && row.name === category);
    const remaining = reportRows?.length
      ? reportRows.reduce((sum, row) => sum + Math.round(row.cash * 100) + Math.round(row.bank * 100) + Math.round(row.government * 100), 0) / 100
      : null;
    const spent = (spentByCategory.get(category) || 0) / 100;
    const total = remaining === null ? null : Math.round((remaining + spent) * 100) / 100;
    const usedPercent = total !== null && total > 0 ? spent / total * 100 : 0;
    return { category, total, spent, remaining, usedPercent };
  }).sort((a, b) => b.spent - a.spent);
  return { date: latestReport?.date, usage };
}
