import axios from "axios";
import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type SupportMessage = {
  id: string;
  senderUid: string;
  senderRole: "user" | "support";
  text: string;
  createdAt: string;
  readAt?: string | null;
  attachments?: SupportAttachment[];
};

export type SupportAttachment = { id: string; name: string; size: number; contentType: string };

export type SupportConversation = {
  uid: string;
  lastMessage: string;
  lastMessageAt: string;
  lastSeenAt?: string;
  online: boolean;
};

export type SupportPresence = { online: boolean; lastSeenAt?: string };

async function request<T>(user: User, method: "GET" | "POST", path: string, data?: unknown): Promise<T> {
  const token = await user.getIdToken();
  const response = await axios.request<T>({
    method,
    url: `${API_URL}/api/v1/customer${path}`,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export const listSupportMessages = (user: User) => request<SupportMessage[]>(user, "GET", "/messages");
export const sendSupportMessage = (user: User, text: string, attachmentIds: string[] = []) => request<SupportMessage>(user, "POST", "/messages", { text, attachmentIds });
export async function uploadSupportAttachment(user: User, file: File): Promise<SupportAttachment> {
  const data = new FormData();
  data.append("file", file);
  const response = await axios.post<SupportAttachment>(`${API_URL}/api/v1/customer/attachments`, data, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  return response.data;
}
export async function downloadSupportAttachment(user: User, attachment: SupportAttachment, uid?: string): Promise<void> {
  const path = uid ? `/conversations/${encodeURIComponent(uid)}/attachments/${encodeURIComponent(attachment.id)}` : `/attachments/${encodeURIComponent(attachment.id)}`;
  const response = await axios.get<Blob>(`${API_URL}/api/v1/customer${path}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` }, responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const markSupportMessageRead = (user: User, id: string) => request<{ read: boolean }>(user, "POST", `/messages/${encodeURIComponent(id)}/read`);
export const sendUserPresence = (user: User) => request<SupportPresence>(user, "POST", "/presence");
export const getSupportPresence = (user: User) => request<SupportPresence>(user, "GET", "/support/presence");

export const listSupportConversations = (user: User) => request<SupportConversation[]>(user, "GET", "/conversations");
export const listConversationMessages = (user: User, uid: string) => request<SupportMessage[]>(user, "GET", `/conversations/${encodeURIComponent(uid)}/messages`);
export const replyToConversation = (user: User, uid: string, text: string) => request<SupportMessage>(user, "POST", `/conversations/${encodeURIComponent(uid)}/messages`, { text });
export const markConversationMessageRead = (user: User, uid: string, id: string) => request<{ read: boolean }>(user, "POST", `/conversations/${encodeURIComponent(uid)}/messages/${encodeURIComponent(id)}/read`);
export const getUserPresence = (user: User, uid: string) => request<SupportPresence>(user, "GET", `/conversations/${encodeURIComponent(uid)}/presence`);
export const sendStaffPresence = (user: User) => request<SupportPresence>(user, "POST", "/support/presence");
