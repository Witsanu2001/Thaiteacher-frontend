import axios from "axios";
import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

const appStateUrl = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/app-state${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;

export async function loadAppState(user: User, viewAsUid?: string): Promise<Record<string, string>> {
  const response = await axios.get<Record<string, string>>(appStateUrl(viewAsUid), { headers: await headers(user) });
  return response.data;
}

export async function writeAppState(user: User, key: string, value: string | null, viewAsUid?: string): Promise<void> {
  await axios.request({ method: value === null ? "DELETE" : "PUT", url: appStateUrl(viewAsUid), data: { key, ...(value === null ? {} : { value }) }, headers: await headers(user) });
}
