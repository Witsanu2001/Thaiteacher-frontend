import axios from "axios";
import type { User } from "firebase/auth";
import type { DailyReport } from "../../shared/funtion/types";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type StoredBudgetReport = DailyReport & { schoolName: string; updatedAt: string };

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

const budgetUrl = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/budget-reports${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;

export async function loadBudgetReports(user: User, viewAsUid?: string): Promise<DailyReport[]> {
  const response = await axios.get<StoredBudgetReport[]>(budgetUrl(viewAsUid), { headers: await headers(user) });
  return response.data.map(({ date, rows }) => ({ date, rows }));
}

export async function saveBudgetReports(user: User, reports: DailyReport[], viewAsUid?: string): Promise<void> {
  for (let offset = 0; offset < reports.length; offset += 400) {
    await axios.put(budgetUrl(viewAsUid), { reports: reports.slice(offset, offset + 400) }, { headers: await headers(user) });
  }
}
