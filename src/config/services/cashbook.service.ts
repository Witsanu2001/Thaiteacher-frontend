import axios from "axios";
import type { User } from "firebase/auth";
import type { CashbookEntry } from "../../shared/funtion/types";
import { activeDataVersion } from "../../shared/funtion/scopedStorage";

export type StoredCashbookEntry = CashbookEntry & { version: string };
const API_URL = import.meta.env.VITE_API_URL ?? "";
const url = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/cashbook${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "X-Data-Version": String(activeDataVersion()) };
}

export async function loadCashbookEntries(user: User, viewAsUid?: string): Promise<StoredCashbookEntry[]> {
  const response = await axios.get<StoredCashbookEntry[]>(url(viewAsUid), { headers: await headers(user) });
  return response.data;
}

export async function saveCashbookEntry(user: User, entry: CashbookEntry, expectedVersion?: string, viewAsUid?: string): Promise<StoredCashbookEntry> {
  const { attachment: _attachment, ...record } = entry;
  void _attachment;
  const response = await axios.put<StoredCashbookEntry>(url(viewAsUid), { entry: record, ...(expectedVersion ? { expectedVersion } : {}) }, { headers: await headers(user) });
  return response.data;
}

export async function deleteCashbookEntry(user: User, id: string, version: string, viewAsUid?: string): Promise<void> {
  await axios.delete(url(viewAsUid), { params: { id }, headers: { ...await headers(user), "If-Match": version } });
}
