import axios from "axios";
import type { User } from "firebase/auth";
import type { UserProfile } from "./users.service";
const API_URL = import.meta.env.VITE_API_URL ?? "";
export interface PaymentRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  amount: number;
  slipPath: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  activatedUntil?: string;
}

export interface AdminPayment extends PaymentRequest {
  uid: string;
  displayName: string;
  email: string;
  schoolName: string;
}
async function request<T>(
  user: User,
  method: "GET" | "POST",
  path: string,
  data?: unknown,
  fresh = false,
) {
  const response = await axios.request<T>({
    method,
    url: `${API_URL}/api/v1/payments${path}`,
    data,
    timeout: 30000,
    thaiTeacherFresh: fresh,
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  return response.data;
}
export const getPaymentRequests = (user: User, fresh = false) =>
  request<PaymentRequest[]>(user, "GET", "", undefined, fresh);
export const createPaymentRequest = (
  user: User,
  payment: Pick<PaymentRequest, "id" | "amount" | "slipPath">,
) => request<PaymentRequest>(user, "POST", "", payment);
export const getAdminPayments = (user: User, fresh = false) =>
  request<AdminPayment[]>(user, "GET", "/admin", undefined, fresh);
export const reviewPayment = (
  user: User,
  payment: AdminPayment,
  decision: "approved" | "rejected",
  reason: string,
) =>
  request<{ payment: PaymentRequest; profile: UserProfile }>(
    user,
    "POST",
    `/admin/${encodeURIComponent(payment.uid)}/${encodeURIComponent(payment.id)}/review`,
    { decision, reason },
  );
export async function getAdminPaymentSlip(user: User, payment: AdminPayment) {
  const response = await axios.get<Blob>(
    `${API_URL}/api/v1/payments/admin/${encodeURIComponent(payment.uid)}/${encodeURIComponent(payment.id)}/slip`,
    {
      responseType: "blob",
      timeout: 25000,
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    },
  );
  return response.data;
}
