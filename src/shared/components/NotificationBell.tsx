import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Bell, X } from "lucide-react";
import { auth } from "../../config/firebase";
import {
  listNotifications,
  markNotificationRead,
  type AppNotification,
} from "../../config/services/notifications.service";

export default function NotificationBell({ demo = false }: { demo?: boolean }) {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const refresh = useCallback(async () => {
    if (!user || demo || requestRef.current) return;
    requestRef.current = true;
    try {
      setItems(await listNotifications(user));
      setError(false);
    } catch {
      setError(true);
    } finally {
      requestRef.current = false;
    }
  }, [user, demo]);

  useEffect(() => {
    if (!user || demo) return;
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initialLoad);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, demo, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleItems = user && !demo ? items : [];
  const unread = visibleItems.filter((item) => !item.readAt).length;
  const read = async (item: AppNotification) => {
    if (!user || item.readAt) return;
    try {
      await markNotificationRead(user, item.id);
      setItems((previous) => previous.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
      ));
    } catch { setError(true); }
  };

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button type="button" onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}
        aria-label={unread ? `การแจ้งเตือน ยังไม่อ่าน ${unread} รายการ` : "เปิดการแจ้งเตือน"}
        aria-expanded={open} className="relative grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <section aria-label="การแจ้งเตือน" className="absolute right-0 top-12 z-50 max-h-[min(70dvh,500px)] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">การแจ้งเตือน</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="ปิดการแจ้งเตือน" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={17} /></button>
        </div>
        {error && <p role="alert" className="px-4 py-2 text-sm text-rose-600">โหลดรายการไม่สำเร็จ <button type="button" onClick={() => void refresh()} className="font-semibold underline">ลองใหม่</button></p>}
        {!error && visibleItems.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">ยังไม่มีการแจ้งเตือน</p>}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {visibleItems.map((item) => <button key={item.id} type="button" onClick={() => void read(item)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.readAt ? "bg-slate-200 dark:bg-slate-700" : "bg-blue-500"}`} />
            <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><strong className="text-sm text-slate-900 dark:text-white">{item.title}</strong><span className="text-xs text-slate-400">{item.category}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{item.body}</span><time className="mt-1 block text-[11px] text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}</time></span>
          </button>)}
        </div>
      </section>}
    </div>
  );
}
