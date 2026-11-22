import axios from "axios";
import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type UserPlan = "trial" | "paid" | "lifetime";

export interface UserProfile {
  schoolRemovalId?: string;
  schoolRemovedFrom?: string;
  uid: string;
  monthlyPriceSatang?: number;
  billingMode?: "school" | "personal" | "individual" | "sponsored";
  accessGranted?: boolean;
  accessPlan?: "trial" | "paid" | "lifetime" | "expired";
  accessPaidUntil?: string | null;
  displayName: string;
  email: string;
  phone: string;
  position: string;
  role: "user" | "supperAdmin";
  schoolName: string;
  schoolId?: string;
  plan: UserPlan | "inactive";
  trialDays?: number;
  createdAt: string | null;
  paidUntil: string | null;
  status?: "active" | "clearing" | "cleared" | "deleted";
  dataVersion?: number;
  clearedAt?: string | null;
  demoSeen?: boolean;
  tourCompleted?: Record<string, boolean>;
}

async function request<T>(
  user: User,
  method: "GET" | "PATCH" | "POST" | "DELETE",
  path: string,
  data?: unknown,
  timeout?: number,
  fresh = false,
): Promise<T> {
  const token = await user.getIdToken();
  const response = await axios.request<T>({
    method,
    url: `${API_URL}/api/v1/users${path}`,
    data,
    timeout,
    thaiTeacherFresh: fresh,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export const getProfile = (user: User, fresh = false): Promise<UserProfile> => request<UserProfile>(user, "GET", "", undefined, 25_000, fresh);
export const updateProfile = (
  user: User,
  profile: Pick<
    UserProfile,
    "displayName" | "phone" | "position" | "schoolName"
  >,
) => request<UserProfile>(user, "PATCH", "", profile);
export const markOnboarding = (
  user: User,
  kind: "demo" | "tour",
  page?: string,
) => request<{ saved: boolean }>(user, "POST", "/onboarding", { kind, page });
export type LegalAcceptance = {
  uid: string;
  version: string;
  acceptedAt: string;
  termsText: string;
  privacyText: string;
  accountEmail: string;
};
export const getLegalAcceptance = (user: User) =>
  request<{
    accepted: boolean;
    version: string;
    acceptance: LegalAcceptance | null;
  }>(user, "GET", "/legal/acceptance");
export const acceptLegal = (user: User, version: string) =>
  request<LegalAcceptance>(user, "POST", "/legal/acceptance", {
    version,
    acceptTerms: true,
    acknowledgePrivacy: true,
  });
export type AdminUserUpdate = Pick<
  UserProfile,
  "displayName" | "phone" | "position" | "schoolName" | "paidUntil" | "role"
> & { plan: UserPlan; monthlyPriceSatang?: number; trialDays?: number };
export const listUsers = (user: User) =>
  request<UserProfile[]>(user, "GET", "/admin");
export interface AdminAnalytics {
  windowStart: string;
  sessions30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  daily: { date: string; sessions: number; activeUsers: number }[];
  frequentUsers: {
    uid: string;
    sessions: number;
    day: number;
    week: number;
    month: number;
    lastVisit: string;
  }[];
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
export const getAdminAnalytics = (user: User) =>
  request<AdminAnalytics>(user, "GET", "/admin/analytics");
export interface VisitorDashboard {
  today: number; week: number; month: number; sessions: number; views: number;
  daily: { date: string; visitors: number; sessions: number; views: number }[];
  pages: { name: string; count: number }[];
  sources: { name: string; count: number }[];
  devices: { name: string; count: number }[];
  recent: { code: string; page: string; device: string; source: string; at: string }[];
  truncated: boolean;
}
export const getVisitorDashboard = (user: User) =>
  request<VisitorDashboard>(user, "GET", "/admin/visitors");
export const recordVisit = (user: User, sessionId: string) =>
  request<void>(user, "POST", "/activity", { sessionId });
export const adminUpdateUser = (
  user: User,
  uid: string,
  changes: AdminUserUpdate,
) =>
  request<UserProfile>(
    user,
    "PATCH",
    `/admin/${encodeURIComponent(uid)}`,
    changes,
  );
export const adminAssignSchool = (user: User, uid: string, schoolId: string) =>
  request<UserProfile>(
    user,
    "POST",
    `/admin/${encodeURIComponent(uid)}/school`,
    { schoolId },
  );
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
export const previewUserClear = (user: User, uid: string) =>
  request<UserClearPreview>(
    user,
    "GET",
    `/admin/${encodeURIComponent(uid)}/clear`,
  );
export const clearUserData = (user: User, uid: string, confirmEmail: string) =>
  request<UserProfile>(
    user,
    "DELETE",
    `/admin/${encodeURIComponent(uid)}/clear`,
    { confirmEmail },
  );
