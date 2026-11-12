import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Bot,
  Loader2,
  Plus,
  Send,
  Sparkles,
  WandSparkles,
  AlertCircle,
  RefreshCcw,
  LockKeyhole,
  Paperclip,
  X,
} from "lucide-react";
import { prepareAiAttachment } from "./prepareAiAttachment";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  time: string;
};

type ChatApiResponse = {
  reply?: string;
};

type ChatGiminiAIPageProps = {
  /** The API Gateway endpoint. */
  endpoint?: string;
  /** Optional: provide the current Firebase ID token from the parent page. */
  getAccessToken?: () => Promise<string | null>;
  /** Optional UI gate for visitors who are not signed in. */
  aiEnabled?: boolean;
  viewAsUid?: string;
  storageKey?: string;
};

const suggestions = [
  "ช่วยแนะนำการจัดทำทะเบียนคุมเงิน",
  "เอกสารอะไรบ้างที่ควรแนบกับใบสำคัญจ่าย",
  "ช่วยตรวจสอบรายการรายรับ–รายจ่าย",
];
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const makeMessage = (role: ChatMessage["role"], text: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  text: role === "assistant" ? text.replace(/\*/g, "") : text,
  time: new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date()),
});

const welcomeMessage = (): ChatMessage =>
  makeMessage(
    "assistant",
    "สวัสดีค่ะ ยินดีช่วยตอบคำถามเกี่ยวกับงานการเงินและเอกสารของโรงเรียนนะคะ ลองพิมพ์คำถามหรือเลือกหัวข้อแนะนำด้านล่างได้เลยค่ะ",
  );

const chatStorageKey = (key: string) => `thaiteacher-ai-chat:${key}`;
const nextSixAM = (now = Date.now()) => {
  const bangkok = new Date(now + 7 * 60 * 60 * 1000);
  return Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth(), bangkok.getUTCDate() + (bangkok.getUTCHours() >= 6 ? 1 : 0), 6) - 7 * 60 * 60 * 1000;
};
const loadMessages = (key?: string): ChatMessage[] => {
  if (!key) return [welcomeMessage()];
  try {
    const saved = JSON.parse(localStorage.getItem(chatStorageKey(key)) || "null") as { expiresAt?: number; messages?: ChatMessage[] } | null;
    if (saved?.expiresAt && saved.expiresAt > Date.now() && Array.isArray(saved.messages)) {
      const valid = saved.messages.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.text === "string" && typeof item.id === "string" && typeof item.time === "string");
      if (valid.length) return valid.slice(-100);
    }
    localStorage.removeItem(chatStorageKey(key));
  } catch { /* Storage can be unavailable in private browsing. */ }
  return [welcomeMessage()];
};

function getFriendlyError(status: number): string {
  switch (status) {
    case 400:
      return "รูปแบบคำถามไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
    case 401:
      return "กรุณาเข้าสู่ระบบอีกครั้งก่อนใช้งาน AI";
    case 402:
      return "บริการ AI ยังไม่พร้อมใช้งานเนื่องจากการตั้งค่าการชำระเงิน";
    case 403:
      return "ผู้ช่วย AI ใช้ได้เฉพาะแพ็กเกจฟรีตลอดชีพและ supperAdmin";
    case 429:
      return "มีการใช้งาน AI มากเกินไปหรือโควตาเต็มแล้ว กรุณาลองใหม่ภายหลัง";
    case 502:
    case 503:
    case 504:
      return "บริการ AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง";
    default:
      return `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${status})`;
  }
}

const aiErrorMessages: Record<string, string> = {
  ai_plan_required: "ผู้ช่วย AI ใช้ได้เฉพาะแพ็กเกจฟรีตลอดชีพและ supperAdmin",
  gemini_key_or_permission: "คีย์ Gemini หรือสิทธิ์เรียก API ไม่ถูกต้อง กรุณาตรวจการตั้งค่า AI service",
  gemini_model_unavailable: "โมเดล Gemini ที่ตั้งค่าไว้ใช้งานไม่ได้ กรุณาตรวจ GEMINI_MODEL",
  gemini_quota_exceeded: "โควตา Gemini เต็มแล้ว กรุณาลองใหม่ภายหลัง",
  gemini_temporarily_unavailable: "Gemini ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
  gemini_bad_request: "Gemini ไม่รับคำขอนี้ กรุณาลองถามใหม่",
};

export default function ChatGiminiAIPage({
  endpoint = `${API_URL}/api/ai/chat`,
  getAccessToken,
  aiEnabled = true,
  viewAsUid,
  storageKey,
}: ChatGiminiAIPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(storageKey));
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isSending, error]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(chatStorageKey(storageKey), JSON.stringify({ expiresAt: nextSixAM(), messages: messages.slice(-100) }));
    } catch { /* The chat still works when storage is full or blocked. */ }
  }, [messages, storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      controllerRef.current?.abort();
      controllerRef.current = null;
      sendingRef.current = false;
      setIsSending(false);
      setMessages([welcomeMessage()]);
      setDraft("");
      setAttachment(null);
      setError(null);
      setFailedText(null);
      try { localStorage.removeItem(chatStorageKey(storageKey)); } catch { /* Ignore storage errors. */ }
    }, Math.max(0, nextSixAM() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const requestReply = async (text: string, appendUser: boolean, file: File | null = attachment) => {
    if (!aiEnabled || sendingRef.current || !text.trim()) return;

    const history = messages.slice(1).slice(-8).map(({ role, text: previous }) => ({ role, text: previous }));

    const controller = new AbortController();
    controllerRef.current = controller;
    sendingRef.current = true;
    setIsSending(true);
    setError(null);
    setFailedText(null);

    if (appendUser) {
      setMessages((current) => [...current, makeMessage("user", file ? `${text}\n📎 ${file.name}` : text)]);
    }

    try {
      const accessToken = getAccessToken ? await getAccessToken() : null;
      if (controller.signal.aborted) return;
      const preparedAttachment = file ? await prepareAiAttachment(file) : undefined;

      const headers: Record<string, string> = {
        "Content-Type": "application/json; charset=utf-8",
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text,
          viewAsUid,
          history: appendUser ? history : history.slice(0, -1),
          attachment: preparedAttachment,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error((payload?.error && aiErrorMessages[payload.error]) || getFriendlyError(response.status));
      }

      const data: ChatApiResponse = await response.json();
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("AI ไม่ได้ส่งคำตอบกลับมา กรุณาลองใหม่อีกครั้ง");
      }

      if (!controller.signal.aborted) {
        setMessages((current) => [...current, makeMessage("assistant", data.reply!)]);
        setAttachment(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(
          err instanceof TypeError
            ? "เชื่อมต่อ AI ไม่สำเร็จ กรุณาตรวจสอบ API Gateway หรืออินเทอร์เน็ต"
            : err instanceof Error
              ? err.message
              : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
        );
        setFailedText(text);
      }
    } finally {
      // A new chat can cancel this request. Do not let an old request
      // affect a newer one.
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        sendingRef.current = false;
        setIsSending(false);
      }
    }
  };

  const send = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || sendingRef.current || !aiEnabled) return;
    setDraft("");
    void requestReply(text || "ช่วยสรุปไฟล์ที่แนบมา", true, attachment);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. During IME composition,
    // Enter confirms the composed word without sending.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  const startNewChat = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    sendingRef.current = false;
    setIsSending(false);
    setError(null);
    setFailedText(null);
    setMessages([welcomeMessage()]);
    setDraft("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    inputRef.current?.focus();
  };

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-blue-900/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 text-white shadow-md shadow-violet-200 dark:shadow-violet-950">
          <Sparkles size={21} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">
            ผู้ช่วย AI สำหรับครู
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ถามเรื่องงานการเงิน เอกสาร และการใช้งาน ThaiTeacher
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
          <Sparkles size={13} />
          Gemini AI
        </span>
        <button
          type="button"
          onClick={startNewChat}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={17} />
          <span className="hidden sm:inline">แชทใหม่</span>
        </button>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="ข้อความสนทนา"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-gradient-to-b from-violet-50/40 via-white to-white px-4 py-6 dark:from-violet-950/10 dark:via-slate-900 dark:to-slate-900 sm:px-8"
      >
        <div className="mx-auto max-w-3xl">
          {!aiEnabled && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
              <LockKeyhole size={18} className="mt-0.5 shrink-0" />
              ผู้ช่วย AI ใช้ได้เฉพาะแพ็กเกจฟรีตลอดชีพและ supperAdmin
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-5 flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  <Bot size={19} />
                </span>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] ${message.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>
                <p className="mt-1 px-1 text-[11px] text-slate-400">{message.time}</p>
              </div>
              {message.role === "user" && (
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  ค
                </span>
              )}
            </div>
          ))}

          {isSending && (
            <div className="mb-5 flex items-center gap-3" role="status">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Bot size={19} />
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Loader2 size={16} className="animate-spin" />
                Gemini กำลังตอบ...
              </span>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle size={18} className="shrink-0" />
              <span className="flex-1">{error}</span>
              {failedText && (
                <button
                  type="button"
                  onClick={() => void requestReply(failedText, false)}
                  disabled={isSending}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  <RefreshCcw size={14} /> ลองอีกครั้ง
                </button>
              )}
            </div>
          )}

          {messages.length === 1 && aiEnabled && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <WandSparkles size={17} className="text-violet-500" />
                เริ่มต้นด้วยคำถามเหล่านี้
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm leading-5 text-slate-600 transition-all hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        {attachment && <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <Paperclip size={15} /><span className="min-w-0 flex-1 truncate">{attachment.name} · {(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
          <button type="button" aria-label="เอาไฟล์แนบออก" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}><X size={16} /></button>
        </div>}
        <form
          onSubmit={send}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-violet-800 dark:focus-within:ring-violet-950"
        >
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx,.xls" onChange={(event) => {
            const file = event.target.files?.[0] || null;
            if (file && file.size > 8 * 1024 * 1024) { setError("ไฟล์แนบต้องมีขนาดไม่เกิน 8 MB"); event.target.value = ""; return; }
            setError(null); setAttachment(file);
          }} />
          <button type="button" aria-label="แนบไฟล์" title="แนบ PDF รูปภาพ หรือ Excel" disabled={!aiEnabled || isSending} onClick={() => fileRef.current?.click()} className="mb-1 grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:hover:bg-slate-700"><Paperclip size={19} /></button>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="พิมพ์ข้อความ"
            placeholder={aiEnabled ? "พิมพ์คำถามของคุณ..." : "สำหรับแพ็กเกจฟรีตลอดชีพและ supperAdmin"}
            disabled={!aiEnabled || isSending}
            maxLength={4000}
            className="max-h-32 min-h-11 flex-1 resize-y bg-transparent px-1 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !attachment) || isSending || !aiEnabled}
            aria-label="ส่งข้อความ"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </section>
  );
}
