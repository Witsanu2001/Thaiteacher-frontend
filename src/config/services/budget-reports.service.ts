import axios from "axios";
import type { User } from "firebase/auth";
import type { DailyReport } from "../../shared/funtion/types";
import { activeDataVersion } from "../../shared/funtion/scopedStorage";
import { projectRemark } from "../../shared/funtion/projectRemark";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type StoredBudgetReport = DailyReport & { schoolName: string; updatedAt: string; version?: string };
const knownVersions = new Map<string, Map<string, string>>();
const scope = (user: User, viewAsUid?: string) => `${user.uid}:${viewAsUid || "self"}`;

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

const budgetUrl = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/budget-reports${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;

export async function loadBudgetReports(user: User, viewAsUid?: string): Promise<DailyReport[]> {
  const response = await axios.get<StoredBudgetReport[]>(budgetUrl(viewAsUid), { headers: await headers(user) });
  knownVersions.set(scope(user, viewAsUid), new Map(response.data.map(report => [report.date, report.version || ""])));
  return response.data.map(({ date, rows }) => ({ date, rows: rows.map(row => ({ ...row, note: projectRemark(row.note || "") })) }));
}

export async function saveBudgetReports(user: User, reports: DailyReport[], viewAsUid?: string): Promise<void> {
  const versions = knownVersions.get(scope(user, viewAsUid)) || new Map<string, string>();
  for (let offset = 0; offset < reports.length; offset += 400) {
    const chunk = reports.slice(offset, offset + 400).map(report => ({
      ...report,
      ...(versions.has(report.date) ? { expectedVersion: versions.get(report.date) } : {}),
    }));
    const response = await axios.put<{ versions: Record<string, string> }>(budgetUrl(viewAsUid), { reports: chunk }, { headers: { ...await headers(user), "X-Data-Version": String(activeDataVersion()) } });
    for (const [date, version] of Object.entries(response.data.versions)) versions.set(date, version);
  }
  knownVersions.set(scope(user, viewAsUid), versions);
}
