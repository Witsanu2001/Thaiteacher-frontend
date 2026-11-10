import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { MessageCircle, Paperclip, SendHorizontal } from "lucide-react";
import AdminHeader from "../../shared/components/AdminHeader";
import { downloadSupportAttachment, getUserPresence, listConversationMessages, listSupportConversations, markConversationMessageRead, replyToConversation, sendStaffPresence, type SupportConversation, type SupportMessage } from "../../config/services/customer.service";
import { listUsers, type UserProfile } from "../../config/services/users.service";

const timeText = (date?: string) => date ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(date)) : "";

export default function AdminSupportPage({ user, onMenu, dark, onToggleDark }: { user: User; onMenu: () => void; dark: boolean; onToggleDark: () => void }) {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [online, setOnline] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    try { setConversations(await listSupportConversations(user)); setError(""); }
    catch { setError("โหลดรายการแชทไม่สำเร็จ กรุณาตรวจสอบบริการลูกค้า"); }
  }, [user]);
  const refreshSelected = useCallback(async () => {
    if (!selected) return;
    try {
      const [items, presence] = await Promise.all([listConversationMessages(user, selected), getUserPresence(user, selected)]);
      setMessages(items); setOnline(presence.online);
      await Promise.allSettled(items.filter(item => item.senderRole === "user" && !item.readAt).map(item => markConversationMessageRead(user, selected, item.id)));
    } catch { setError("โหลดข้อความไม่สำเร็จ"); }
  }, [user, selected]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void refreshList(); }, 0);
    void listUsers(user).then(items => setProfiles(Object.fromEntries(items.map(item => [item.uid, item])))).catch(() => undefined);
    void sendStaffPresence(user).catch(() => undefined);
    const poll = window.setInterval(() => { void refreshList(); }, 10000);
    const heartbeat = window.setInterval(() => { void sendStaffPresence(user).catch(() => undefined); }, 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); window.clearInterval(heartbeat); };
  }, [user, refreshList]);
  useEffect(() => { const initial = window.setTimeout(() => { void refreshSelected(); }, 0); const poll = window.setInterval(() => { void refreshSelected(); }, 10000); return () => { window.clearTimeout(initial); window.clearInterval(poll); }; }, [refreshSelected]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!selected || !text || sending) return;
    setSending(true); setError("");
    try {
      const message = await replyToConversation(user, selected, text);
      setMessages(current => [...current.filter(item => item.id !== message.id), message]); setDraft("");
      void refreshList();
    } catch { setError("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { setSending(false); }
  };

  return <div className="flex h-dvh min-h-0 flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <AdminHeader title="บริการลูกค้า" onMenu={onMenu} dark={dark} onToggleDark={onToggleDark} />
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-5 lg:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:max-h-none lg:w-80">
        <div className="border-b border-slate-100 px-4 py-3 font-semibold dark:border-slate-800">บทสนทนาทั้งหมด <span className="text-sm text-slate-500">({conversations.length})</span></div>
        <div className="overflow-y-auto p-2">{conversations.length === 0 && <p className="p-3 text-sm text-slate-500">ยังไม่มีข้อความจากผู้ใช้</p>}{conversations.map(item => <button key={item.uid} type="button" onClick={() => { setSelected(item.uid); setMessages([]); }} className={`mb-1 w-full rounded-xl p-3 text-left ${selected === item.uid ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><span className="flex items-center gap-2"><span className={`size-2 rounded-full ${item.online ? "bg-emerald-500" : "bg-slate-300"}`} /><strong className="min-w-0 flex-1 truncate text-sm">{profiles[item.uid]?.displayName || profiles[item.uid]?.email || item.uid}</strong></span><span className="mt-1 block truncate text-xs text-slate-500">{item.lastMessage}</span><span className="mt-1 block text-[11px] text-slate-400">{timeText(item.lastMessageAt)}</span></button>)}</div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {selected ? <><div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800"><MessageCircle className="text-blue-600" size={20} /><div className="min-w-0"><h2 className="truncate font-semibold">{profiles[selected]?.displayName || profiles[selected]?.email || selected}</h2><p className="text-xs text-slate-500">{online ? "ผู้ใช้ออนไลน์" : "ผู้ใช้ออฟไลน์"}</p></div></div><div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{messages.map(message => <div key={message.id} className={`flex ${message.senderRole === "support" ? "justify-end" : "justify-start"}`}><div className="max-w-[85%]"><div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${message.senderRole === "support" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{message.text}{message.attachments?.map(file => <button key={file.id} type="button" onClick={() => { void downloadSupportAttachment(user, file, selected).catch(() => setError("ดาวน์โหลดไฟล์ไม่สำเร็จ")); }} className="mt-2 flex max-w-full items-center gap-2 rounded-lg bg-white/15 px-2 py-1 text-left text-xs hover:underline"><Paperclip size={14} className="shrink-0" /><span className="truncate">{file.name}</span></button>)}</div><p className="mt-1 text-[11px] text-slate-400">{timeText(message.createdAt)}{message.senderRole === "support" ? message.readAt ? " · อ่านแล้ว" : " · ส่งแล้ว" : ""}</p></div></div>)}</div><form onSubmit={event => { void send(event); }} className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} aria-label="พิมพ์ข้อความตอบกลับ" placeholder="พิมพ์ข้อความตอบกลับ…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800" /><button disabled={!draft.trim() || sending} aria-label="ส่งข้อความ" className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white disabled:bg-slate-300"><SendHorizontal size={18} /></button></form></> : <div className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-500">เลือกบทสนทนาด้านซ้ายเพื่ออ่านและตอบกลับ</div>}
        {error && <p role="alert" className="px-4 pb-2 text-xs text-rose-600">{error}</p>}
      </section>
    </main>
  </div>;
}
