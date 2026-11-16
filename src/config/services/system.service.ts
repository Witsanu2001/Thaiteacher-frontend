import axios from "axios";
import type { User } from "firebase/auth";
const API_URL = import.meta.env.VITE_API_URL ?? "";
export interface SystemSettings {
  trialDays: number;
  updatedAt?: string;
  updatedBy?: string;
}
async function request(user: User, method: "GET" | "PATCH", data?: unknown) {
  const response = await axios.request<SystemSettings>({
    method,
    url: `${API_URL}/api/v1/system/admin/settings`,
    data,
    timeout: 25000,
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  return response.data;
}
export const getSystemSettings = (user: User) => request(user, "GET");
export const saveSystemSettings = (user: User, trialDays: number) =>
  request(user, "PATCH", { trialDays });
