import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import type { User } from "firebase/auth";
import {
  subscribeSupportMessages,
  type SupportMessage,
} from "../../config/services/customer.service";

type Props = {
  user: User;
  onUnreadCountChange: (count: number) => void;
};

export default function SupportChatNotifications({
  user,
  onUnreadCountChange,
}: Props) {
  const [notification, setNotification] = useState<SupportMessage | null>(null);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const seenMessageIds = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeSupportMessages(user, messages => {
        const supportMessages = messages.filter(
          (message) => message.senderRole === "support",
        );
        onUnreadCountChange(
          supportMessages.filter((message) => !message.readAt).length,
        );

        if (initialized.current) {
          const incoming = supportMessages.filter(
            (message) => !seenMessageIds.current.has(message.id),
          );
          if (incoming.length > 0) {
            const latest = incoming.reduce((current, message) =>
              message.createdAt > current.createdAt ? message : current,
            );
            setNotificationVisible(false);
            setNotification(latest);
          }
        }

        supportMessages.forEach((message) =>
          seenMessageIds.current.add(message.id),
        );
        initialized.current = true;
    });
    return unsubscribe;
  }, [user, onUnreadCountChange]);

  useEffect(() => {
    if (!notification) return;
    const enterFrame = window.requestAnimationFrame(() =>
      setNotificationVisible(true),
    );
    const hideTimeout = window.setTimeout(
      () => setNotificationVisible(false),
      5_000,
    );
    const removeTimeout = window.setTimeout(
      () => setNotification(null),
      5_300,
    );
    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.clearTimeout(hideTimeout);
      window.clearTimeout(removeTimeout);
    };
  }, [notification]);

  if (!notification) return null;

  return createPortal(
    <aside
      key={notification.id}
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-20 z-[90] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_16px_50px_-12px_rgba(15,23,42,0.35)] transition-all duration-300 ease-out motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-white ${notificationVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
    >
      <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-500" />
      <div className="flex items-start gap-3 p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              ข้อความใหม่
            </p>
            <span className="size-2 rounded-full bg-rose-500 motion-safe:animate-pulse" />
          </div>
          <p className="mt-0.5 text-sm font-semibold">ทีม ThaiTeacher</p>
          <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600 dark:text-slate-300">
            {notification.text || "ส่งไฟล์แนบมาให้"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotificationVisible(false);
            window.setTimeout(() => setNotification(null), 300);
          }}
          aria-label="ปิดการแจ้งเตือน"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={18} />
        </button>
      </div>
    </aside>,
    document.body,
  );
}
