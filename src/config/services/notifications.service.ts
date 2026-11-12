import axios from "axios";
import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  readAt: string | null;
};

export async function listNotifications(user: User): Promise<AppNotification[]> {
  const token = await user.getIdToken();
  const { data } = await axios.get<AppNotification[]>(`${API_URL}/api/v1/users/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function markNotificationRead(user: User, id: string): Promise<void> {
  const token = await user.getIdToken();
  await axios.post(`${API_URL}/api/v1/users/notifications/${encodeURIComponent(id)}/read`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendNotification(user: User, uid: string, title: string, body: string, category = "ประกาศ"): Promise<AppNotification> {
  const token = await user.getIdToken();
  const { data } = await axios.post<AppNotification>(`${API_URL}/api/v1/users/admin/${encodeURIComponent(uid)}/notifications`,
    { title, body, category }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

export async function broadcastNotification(user: User, requestId: string, title: string, body: string): Promise<{ recipients: number }> {
  const token = await user.getIdToken();
  const { data } = await axios.post<{ recipients: number }>(`${API_URL}/api/v1/users/admin/notifications/broadcast`,
    { requestId, title, body }, { headers: { Authorization: `Bearer ${token}` }, timeout: 60_000 });
  return data;
}
