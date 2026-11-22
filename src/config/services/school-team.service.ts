import { validSchoolInvitationTerms } from "../../shared/funtion/schoolInvitationTerms";
import axios from "axios";
import type { User } from "firebase/auth";
import type { UserProfile } from "./users.service";
const API_URL = import.meta.env.VITE_API_URL ?? "";
export interface SchoolInvitation { billingMode: "sponsored" | "individual"; id: string; email: string; expiresAt: string; }
export interface SchoolTeam {
 schoolPaymentMode: "owner_pays" | "split" | ""; invitationPolicyVersion: number; schoolId: string; schoolName: string; isOwner: boolean; limit: number; billingMode: string; monthlyPriceSatang: number; sponsoredActive: boolean;
 members: { uid: string; displayName: string; email?: string; owner: boolean }[];
 invitations: SchoolInvitation[];
}
export interface InvitationPreview { billingMode: "sponsored" | "individual"; individualPriceSatang: number; sponsoredActive: boolean; schoolName: string; ownerName: string; expiresAt: string; }
async function request<T>(user: User, method: "GET" | "POST" | "DELETE" | "PATCH", path: string, data?: unknown) {
 const response = await axios.request<T>({ method, url: `${API_URL}/api/v1/users/school${path}`, data,
 timeout: 30000, thaiTeacherFresh: true, headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
 return response.data;
}
export const getSchoolTeam = (user: User) => request<SchoolTeam>(user, "GET", "/team");
export const createSchoolInvitation = (user: User, email: string, billingMode: "sponsored" | "individual") => request<{ invitation: SchoolInvitation; token: string }>(user, "POST", "/invitations", { email, billingMode });
export const revokeSchoolInvitation = (user: User, id: string) => request(user, "DELETE", `/invitations/${encodeURIComponent(id)}`);
export const removeSchoolMember = (user: User, uid: string) => request<{ ok: boolean }>(user, "DELETE", `/members/${encodeURIComponent(uid)}`);
export const acknowledgeSchoolRemoval = (user: User, removalId: string) => request<{ ok: boolean }>(user, "POST", "/removal/acknowledge", { removalId });
export async function previewSchoolInvitation(user: User, token: string): Promise<InvitationPreview> {
 const value = await request<InvitationPreview>(user, "POST", "/invitations/preview", { token });
 if (!validSchoolInvitationTerms(value)) throw new Error("invitation_configuration_missing");
 return value;
}
export const acceptSchoolInvitation = (user: User, token: string) => request<UserProfile>(user, "POST", "/invitations/accept", { token });
export function schoolTeamError(error: unknown) {
 if (error instanceof Error && error.message === "invitation_configuration_missing") return "คำเชิญนี้ยังไม่มีรูปแบบชำระเงินหรือราคาที่ถูกต้อง กรุณาให้ผู้เชิญสร้างคำเชิญใหม่หลังอัปเดตระบบ";
 const code = axios.isAxiosError(error) ? error.response?.data?.error : "";
 const messages: Record<string, string> = {
  school_billing_mode_locked: "รูปแบบชำระเงินของโรงเรียนถูกกำหนดแล้ว หรือมีสมาชิก/คำเชิญ/การชำระเงินเดิม กรุณาใช้รูปแบบเดิมหรือติดต่อผู้ดูแลก่อนเปลี่ยน",
  school_account_limit: "โรงเรียนมีครบ 10 บัญชีแล้ว (รวมบัญชีหลัก)",
  invitation_limit: "มีคำเชิญค้างอยู่แล้ว หรือจำนวนสมาชิกและคำเชิญเต็ม กรุณายกเลิกคำเชิญเดิมก่อน",
  invalid_or_expired_invitation: "คำเชิญไม่ถูกต้อง หมดอายุ ถูกยกเลิก ใช้แล้ว หรือไม่ได้เชิญอีเมลที่คุณเข้าสู่ระบบ",
  school_has_finance_data: "บัญชีนี้มีข้อมูลการเงินของโรงเรียนเดิม กรุณาติดต่อผู้ดูแลระบบก่อนย้าย เพื่อป้องกันข้อมูลสูญหาย",
  school_has_members: "บัญชีนี้มีสมาชิกโรงเรียนอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบก่อนย้าย",
  forbidden: "บัญชีนี้ไม่มีสิทธิ์ทำรายการ สมาชิกสร้างคำเชิญไม่ได้ หรือบัญชีเข้าร่วมโรงเรียนอื่นอยู่แล้ว",
  invalid_profile: "กรุณาตรวจอีเมลผู้รับ ต้องไม่ใช่บัญชีหลักหรือสมาชิกที่อยู่ในโรงเรียนแล้ว",
 };
 return messages[code] || "ทำรายการไม่สำเร็จ กรุณาลองใหม่เมื่อเชื่อมต่อระบบได้";
}


export const setSchoolPaymentMode = (user: User, billingMode: "sponsored" | "individual") => request<UserProfile>(user, "POST", "/payment-policy", { billingMode });
