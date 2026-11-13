import axios from "axios";
import type { User } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { realtimeDb } from "../firebase";

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

type MessageListener = (messages: SupportMessage[]) => void;
type MessageStream = { listeners: Set<MessageListener>; errors: Set<() => void>; close: () => void; running: boolean; pending: boolean; messages?: SupportMessage[] };
const messageStreams = new Map<string, MessageStream>();

/** One RTDB listener and one API fetch per user, shared by the chat and notification bell. */
export function subscribeSupportMessages(user: User, listener: MessageListener, onError?: () => void): () => void {
  let stream = messageStreams.get(user.uid);
  if (!stream) {
    stream = { listeners: new Set(), errors: new Set(), close: () => undefined, running: false, pending: false };
    messageStreams.set(user.uid, stream);
    const current = stream;
    const refresh = async () => {
      if (current.running) { current.pending = true; return; }
      current.running = true;
      do {
        current.pending = false;
        try {
          const messages = await listSupportMessages(user);
          if (messageStreams.get(user.uid) === current) {
            current.messages = messages;
            current.listeners.forEach(callback => callback(messages));
          }
        } catch (error) { console.error("Failed to load support messages", error); current.errors.forEach(callback => callback()); }
      } while (current.pending && messageStreams.get(user.uid) === current);
      current.running = false;
    };
    let lastFallbackRefresh = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFallbackRefresh < 60_000) return;
      lastFallbackRefresh = Date.now();
      void refresh();
    };
    let focusAttached = false;
    const fallback = () => { if (!focusAttached) { window.addEventListener("focus", onFocus); focusAttached = true; } };
    // Load history immediately. The first RTDB snapshot is only the current signal,
    // so fetching again for that snapshot would duplicate the same API request.
    void refresh();
    let firstSignal = true;
    const unsubscribe = realtimeDb
      ? onValue(ref(realtimeDb, `supportSignals/conversations/${user.uid}`), () => {
          if (firstSignal) { firstSignal = false; return; }
          void refresh();
        }, error => { console.error("Realtime support messages unavailable", error); fallback(); })
      : (fallback(), () => undefined);
    current.close = () => { unsubscribe(); window.removeEventListener("focus", onFocus); };
  }
  stream.listeners.add(listener);
  if (onError) stream.errors.add(onError);
  if (stream.messages) listener(stream.messages);
  return () => {
    stream.listeners.delete(listener);
    if (onError) stream.errors.delete(onError);
    if (stream.listeners.size === 0) { stream.close(); messageStreams.delete(user.uid); }
  };
}

export function subscribeSupportSignal(path: string, onChange: () => void): () => void {
  let lastFallbackRefresh = Date.now();
  const onFocus = () => {
    if (Date.now() - lastFallbackRefresh < 60_000) return;
    lastFallbackRefresh = Date.now();
    onChange();
  };
  let focusAttached = false;
  const fallback = () => { if (!focusAttached) { window.addEventListener("focus", onFocus); focusAttached = true; } };
  if (!realtimeDb) { fallback(); onChange(); return () => window.removeEventListener("focus", onFocus); }
  const unsubscribe = onValue(ref(realtimeDb, `supportSignals/${path}`), onChange, error => { console.error("Realtime support signal unavailable", error); fallback(); onChange(); });
  return () => { unsubscribe(); window.removeEventListener("focus", onFocus); };
}
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
