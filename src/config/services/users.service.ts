import axios from "axios";
import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type UserPlan = "trial" | "paid" | "lifetime";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  position: string;
  role: "user" | "supperAdmin";
  schoolName: string;
  plan: UserPlan | "inactive";
  createdAt: string | null;
  paidUntil: string | null;
  status?: "active" | "clearing" | "cleared";
  dataVersion?: number;
  clearedAt?: string | null;
}

export interface PaymentRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  slipPath: string;
  submittedAt: string;
}

async function request<T>(user: User, method: "GET" | "PATCH" | "POST" | "DELETE", path: string, data?: unknown): Promise<T> {
  const token = await user.getIdToken();
  const response = await axios.request<T>({
    method,
    url: `${API_URL}/api/v1/users${path}`,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export const getProfile = async (user: User) => {
  await user.getIdToken(true);
  return request<UserProfile>(user, "GET", "");
};
export const updateProfile = (user: User, profile: Pick<UserProfile, "displayName" | "phone" | "position" | "schoolName">) =>
  request<UserProfile>(user, "PATCH", "", profile);
export const getPaymentRequests = (user: User) => request<PaymentRequest[]>(user, "GET", "/payments");
export const createPaymentRequest = (user: User, payment: Pick<PaymentRequest, "id" | "amount" | "slipPath">) =>
  request<PaymentRequest>(user, "POST", "/payments", payment);
export type AdminUserUpdate = Pick<UserProfile, "displayName" | "phone" | "position" | "schoolName" | "paidUntil" | "role"> & { plan: UserPlan };
export const listUsers = (user: User) => request<UserProfile[]>(user, "GET", "/admin");
export interface AdminAnalytics {
  windowStart: string;
  sessions30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  daily: { date: string; sessions: number; activeUsers: number }[];
  frequentUsers: { uid: string; sessions: number; day: number; week: number; month: number; lastVisit: string }[];
  firestore: {
    available: boolean;
    error?: string;
    periodStart: string;
    asOf: string;
    reads: { used: number; freeDailyLimit: number; percent: number };
    writes: { used: number; freeDailyLimit: number; percent: number };
    deletes: { used: number; freeDailyLimit: number; percent: number };
  };
}
export const getAdminAnalytics = (user: User) => request<AdminAnalytics>(user, "GET", "/admin/analytics");
export const recordVisit = (user: User, sessionId: string) => request<void>(user, "POST", "/activity", { sessionId });
export const adminUpdateUser = (user: User, uid: string, changes: AdminUserUpdate) =>
  request<UserProfile>(user, "PATCH", `/admin/${encodeURIComponent(uid)}`, changes);
export interface UserClearPreview {
  uid: string;
  displayName: string;
  email: string;
  budgetReports: number;
  paymentRequests: number;
  otherDocuments: number;
  slipFiles: number;
  status: string;
}
export const previewUserClear = (user: User, uid: string) => request<UserClearPreview>(user, "GET", `/admin/${encodeURIComponent(uid)}/clear`);
export const clearUserData = (user: User, uid: string, confirmEmail: string) =>
  request<UserProfile>(user, "DELETE", `/admin/${encodeURIComponent(uid)}/clear`, { confirmEmail });
