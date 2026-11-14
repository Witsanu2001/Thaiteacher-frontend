import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { User } from "firebase/auth";
import { CircleHelp, CreditCard, FileSpreadsheet, MessageCircle, Paperclip, SendHorizontal, X } from "lucide-react";
import { downloadSupportAttachment, markSupportMessageRead, sendSupportMessage, subscribeSupportMessages, uploadSupportAttachment, type SupportMessage } from "../../config/services/customer.service";
import { connectUserPresence, subscribeStaffPresence } from "../../config/services/supportPresence.service";

type ChatMessage = SupportMessage & { files?: File[] };
const topics = [
  { label: "วิธีใช้งานระบบ", icon: CircleHelp, prompt: "ขอคำแนะนำการเริ่มใช้งานระบบ" },
  { label: "นำเข้าข้อมูล Excel", icon: FileSpreadsheet, prompt: "สอบถามการนำเข้ารายงานจาก Excel" },
  { label: "แพ็กเกจและชำระเงิน", icon: CreditCard, prompt: "สอบถามแพ็กเกจและการชำระเงิน" },
];
const welcome: ChatMessage = { id: "welcome", senderUid: "support", senderRole: "support", text: "สวัสดีค่ะ 👋 หากมีคำถามหรือพบปัญหาในการใช้งาน ThaiTeacher พิมพ์รายละเอียดไว้ได้เลย", createdAt: new Date().toISOString() };
const timeText = (date: string) => new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(date));

export default function ContactPage({ user, demo = false }: { user?: User; demo?: boolean }) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(demo ? [welcome] : []);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || demo) return;
    const unsubscribe = subscribeSupportMessages(user, items => {
      setMessages(items);
      setError("");
      setLoading(false);
      void Promise.allSettled(items.filter(item => item.senderRole === "support" && !item.readAt).map(item => markSupportMessageRead(user, item.id)));
    }, () => { setError("โหลดแชทไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อบริการลูกค้า"); setLoading(false); });
    const disconnect = connectUserPresence(user);
    const unsubscribePresence = subscribeStaffPresence(setOnline);
    return () => { unsubscribe(); disconnect(); unsubscribePresence(); };
  }, [user, demo]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = draft.trim();
    if ((!text && files.length === 0) || sending) return;
    if (demo || !user) {
      setMessages(current => [...current, { id: crypto.randomUUID(), senderUid: "demo", senderRole: "user", text, createdAt: new Date().toISOString(), files }]);
      setDraft(""); setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (files.length > 5 || files.some(file => file.size > 10 * 1024 * 1024)) { setError("แนบได้สูงสุด 5 ไฟล์ ไฟล์ละไม่เกิน 10 MB"); return; }
    setSending(true); setError("");
    try {
      const uploaded = await Promise.all(files.map(file => uploadSupportAttachment(user, file)));
      const message = await sendSupportMessage(user, text, uploaded.map(file => file.id));
      setMessages(current => [...current.filter(item => item.id !== message.id), message]);
      setDraft(""); setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch { setError("ส่งข้อความไม่สำเร็จ ข้อความยังอยู่ในช่องพิมพ์ กรุณาลองอีกครั้ง"); }
    finally { setSending(false); }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } };
  const downloadFile = (file: File) => { const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };

  return <div data-tour="contact-chat" className="flex min-h-0 w-full flex-1 flex-col"><section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-blue-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
    <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white"><MessageCircle size={22} /></span><div className="min-w-0"><h3 className="font-semibold">ทีม ThaiTeacher</h3><p className="text-xs text-slate-500">{demo ? "ตัวอย่างการสนทนา · ยังไม่ส่งถึงทีมงาน" : online ? "เจ้าหน้าที่ออนไลน์" : "ฝากข้อความไว้ได้ เจ้าหน้าที่จะตอบกลับในแชทนี้"}</p></div><span className={`ml-auto rounded-full px-2.5 py-1 text-xs ${demo ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : online ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>{demo ? "ตัวอย่าง" : online ? "ออนไลน์" : "ออฟไลน์"}</span></div>
    <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-sky-50/50 via-white to-white px-4 py-5 dark:from-slate-950/40 dark:via-slate-900 dark:to-slate-900 sm:px-6">
      {!loading && messages.length === 0 && <p className="text-center text-sm text-slate-500">เริ่มสนทนากับทีม ThaiTeacher ได้เลย</p>}
      {messages.map(message => <div key={message.id} className={`flex ${message.senderRole === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] sm:max-w-[72%] ${message.senderRole === "user" ? "text-right" : ""}`}><div className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-6 shadow-sm ${message.senderRole === "user" ? "rounded-br-md bg-gradient-to-br from-blue-600 to-sky-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"}`}>{message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}{message.files?.map((file, index) => <button key={`${file.name}-${index}`} type="button" onClick={() => downloadFile(file)} className="mt-2 flex max-w-full items-center gap-2 rounded-lg bg-white/15 px-2 py-1 text-left hover:underline"><Paperclip size={15} className="shrink-0" /><span className="truncate">{file.name}</span></button>)}{user && message.attachments?.map(file => <button key={file.id} type="button" onClick={() => { void downloadSupportAttachment(user, file).catch(() => setError("ดาวน์โหลดไฟล์ไม่สำเร็จ")); }} className="mt-2 flex max-w-full items-center gap-2 rounded-lg bg-white/15 px-2 py-1 text-left hover:underline"><Paperclip size={15} className="shrink-0" /><span className="truncate">{file.name}</span></button>)}</div><p className="mt-1 px-1 text-[11px] text-slate-400">{message.id === "welcome" ? "ตัวอย่าง" : timeText(message.createdAt)}{message.senderRole === "user" && !demo ? message.readAt ? " · อ่านแล้ว" : " · ส่งแล้ว" : ""}</p></div></div>)}
    </div>
    <form onSubmit={event => { void send(event); }} className="border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4"><div className="mb-3"><p className="mb-2 text-xs font-semibold text-slate-500">หัวข้อที่สอบถามบ่อย</p><div className="flex flex-wrap gap-2">{topics.map(({ label, icon: Icon, prompt }) => <button key={label} type="button" onClick={() => { setDraft(prompt); inputRef.current?.focus(); }} className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"><Icon size={14} />{label}</button>)}</div></div>
      <input ref={fileRef} type="file" multiple className="hidden" aria-label="เลือกไฟล์แนบ" onChange={event => setFiles(current => [...current, ...Array.from(event.target.files ?? [])])} />
      {files.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700"><Paperclip size={13} /><span className="max-w-40 truncate">{file.name}</span><button type="button" aria-label={`ลบไฟล์ ${file.name}`} onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}><X size={14} /></button></span>)}</div>}
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-blue-950"><button type="button" onClick={() => fileRef.current?.click()} aria-label="แนบไฟล์" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><Paperclip size={20} /></button><textarea ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={1000} placeholder="พิมพ์คำถามหรือปัญหาที่พบ…" aria-label="พิมพ์ข้อความ" className="max-h-24 min-h-10 w-full resize-none bg-transparent px-2 py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400" /><button type="submit" disabled={sending || (!draft.trim() && files.length === 0)} aria-label="ส่งข้อความ" className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"><SendHorizontal size={19} /></button></div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}{demo && <p className="mt-2 text-xs text-slate-500">ข้อความและไฟล์แนบในโหมดตัวอย่างจะไม่ส่งถึงทีมงาน</p>}
    </form>
  </section></div>;
}
