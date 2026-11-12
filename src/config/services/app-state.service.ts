import axios from "axios";
import type { User } from "firebase/auth";
import { activeDataVersion } from "../../shared/funtion/scopedStorage";

const API_URL = import.meta.env.VITE_API_URL ?? "";
type AppStateSnapshot = { values: Record<string, string>; versions: Record<string, string> };
const knownVersions = new Map<string, Map<string, string>>();
const scope = (user: User, viewAsUid?: string) => `${user.uid}:${viewAsUid || "self"}`;

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

const appStateUrl = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/app-state${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;

export async function loadAppState(user: User, viewAsUid?: string): Promise<Record<string, string>> {
  const response = await axios.get<AppStateSnapshot>(`${appStateUrl(viewAsUid)}${viewAsUid ? "&" : "?"}withVersions=1`, { headers: await headers(user) });
  knownVersions.set(scope(user, viewAsUid), new Map(Object.entries(response.data.versions)));
  return response.data.values;
}

export async function writeAppState(user: User, key: string, value: string | null, viewAsUid?: string): Promise<void> {
  const versions = knownVersions.get(scope(user, viewAsUid));
  if (!versions) throw new Error("โหลดข้อมูลล่าสุดก่อนบันทึก");
  const response = await axios.request<{ version?: string }>({
    method: value === null ? "DELETE" : "PUT",
    url: appStateUrl(viewAsUid),
    data: { key, ...(value === null ? {} : { value }), ...(versions.has(key) ? { expectedVersion: versions.get(key) } : {}) },
    headers: { ...await headers(user), "X-Data-Version": String(activeDataVersion()) },
  });
  if (value === null) versions.delete(key);
  else if (response.data.version) versions.set(key, response.data.version);
}
