import { useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  AlertCircle,
  Eye,
  LoaderCircle,
  Megaphone,
  Send,
  Sparkles,
} from "lucide-react";
import AdminHeader from "../../shared/components/AdminHeader";
import { broadcastNotification } from "../../config/services/notifications.service";

type Props = {
  user: User;
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
};

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function AdminAnnouncementsPage({
  user,
  onMenu,
  dark,
  onToggleDark,
}: Props) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [body, setBody] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const pendingPublish = useRef<{ id: string; title: string; body: string } | null>(null);

  const publish = async () => {
    if (!title.trim() || !body.trim() || sending) return;
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const draft = { title: title.trim(), body: body.trim() };
      if (!pendingPublish.current || pendingPublish.current.title !== draft.title || pendingPublish.current.body !== draft.body) {
        pendingPublish.current = { ...draft, id: crypto.randomUUID() };
      }
      const result = await broadcastNotification(user, pendingPublish.current.id, draft.title, draft.body);
      pendingPublish.current = null;
      setSuccess(`ส่งประกาศถึงผู้ใช้งาน ${result.recipients} บัญชีแล้ว`);
    } catch {
      setError("ส่งประกาศไม่ครบ กรุณากดส่งอีกครั้ง ระบบจะไม่สร้างรายการซ้ำ");
    } finally {
      setSending(false);
    }
  };

  const requestAi = async (mode: "draft" | "formalize") => {
    const source = mode === "draft" ? brief.trim() : body.trim();
    if (!source || aiBusy) {
      if (!source) {
        setError(
          mode === "draft"
            ? "กรอกรายละเอียดที่ต้องการประกาศก่อนให้ AI ช่วยร่าง"
            : "เขียนเนื้อหาก่อนให้ AI ช่วยปรับภาษา",
        );
      }
      return;
    }

    setAiBusy(true);
    setError("");
    setSuccess("");
    const message =
      mode === "draft"
        ? `ช่วยร่างเนื้อหาประกาศภาษาไทยสำหรับระบบ ThaiTeacher ให้ชัดเจน สุภาพ และเป็นทางการ ใช้หัวข้อ "${title.trim() || "ประกาศจากระบบ"}" และรายละเอียดต่อไปนี้เท่านั้น ห้ามแต่งข้อเท็จจริงเพิ่ม และส่งกลับเฉพาะเนื้อหาประกาศ:\n${source}`
        : `ปรับเนื้อหาประกาศต่อไปนี้ให้ชัดเจน สุภาพ และเป็นทางการขึ้น โดยรักษาความหมายและข้อเท็จจริงเดิม ห้ามเพิ่มข้อมูลใหม่ และส่งกลับเฉพาะเนื้อหาที่ปรับแล้ว:\n${source}`;

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ message }),
      });
      let payload: { reply?: unknown } | null = null;
      try {
        payload = (await response.json()) as { reply?: unknown };
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error("AI ช่วยเขียนไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
      }
      if (typeof payload?.reply !== "string" || !payload.reply.trim()) {
        throw new Error("AI ไม่ได้ส่งข้อความกลับมา กรุณาลองใหม่อีกครั้ง");
      }
      setBody(payload.reply.trim());
      setSuccess(
        mode === "draft"
          ? "AI ร่างเนื้อหาประกาศให้แล้ว ตรวจสอบและแก้ไขก่อนใช้งาน"
          : "ปรับภาษาให้แล้ว กรุณาตรวจสอบเนื้อหาอีกครั้ง",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "AI ช่วยเขียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <AdminHeader
        title="ประกาศ"
        onMenu={onMenu}
        dark={dark}
        onToggleDark={onToggleDark}
      />
      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                สำหรับผู้ดูแลระบบ
              </p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                สร้างประกาศ
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                ร่างและตรวจสอบตัวอย่างประกาศก่อนนำไปใช้งาน
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <AlertCircle size={14} />
              ยังไม่เผยแพร่
            </span>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section data-tour="admin-announcement-form" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center gap-2">
                <Megaphone
                  size={18}
                  className="text-blue-600 dark:text-blue-300"
                />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  รายละเอียดประกาศ
                </h3>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                หัวข้อประกาศ
                <input
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setError("");
                  }}
                  maxLength={160}
                  placeholder="เช่น แจ้งกำหนดการปิดปรับปรุงระบบ"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                รายละเอียดสำหรับให้ AI ช่วยร่าง
                <textarea
                  value={brief}
                  onChange={(event) => {
                    setBrief(event.target.value);
                    setError("");
                  }}
                  rows={3}
                  maxLength={2000}
                  placeholder="บอกข้อมูลสำคัญ เช่น เรื่องที่ต้องแจ้ง วันเวลา และสิ่งที่ผู้ใช้ควรทำ"
                  className="resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                />
              </label>

              <button
                type="button"
                disabled={aiBusy || !brief.trim()}
                onClick={() => void requestAi("draft")}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
              >
                {aiBusy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                ช่วยร่างด้วย AI
              </button>

              <label className="grid gap-1.5 text-sm font-medium">
                เนื้อหาประกาศ
                <textarea
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  rows={9}
                  maxLength={2000}
                  placeholder="พิมพ์เนื้อหาประกาศ หรือใช้ AI ช่วยร่างจากรายละเอียดด้านบน"
                  className="resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  {body.length}/2000 ตัวอักษร
                </span>
                <button
                  type="button"
                  disabled={aiBusy || !body.trim()}
                  onClick={() => void requestAi("formalize")}
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-900 dark:text-violet-300 dark:hover:bg-violet-950"
                >
                  {aiBusy ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  ปรับภาษาให้เป็นทางการ
                </button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
                  {success}
                </p>
              )}
            </section>

            <section className="flex min-h-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
                <Eye size={17} className="text-slate-500" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  ตัวอย่างประกาศ
                </h3>
                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  ตรวจทานก่อนส่ง
                </span>
              </div>
              <article className="flex-1 p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  <Megaphone size={15} />
                  ประกาศจาก ThaiTeacher
                </div>
                <h4 className="mt-4 whitespace-pre-wrap break-words text-xl font-bold text-slate-900 dark:text-white">
                  {title.trim() || "หัวข้อประกาศ"}
                </h4>
                <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {body.trim() || (
                    <span className="text-slate-400">
                      เนื้อหาประกาศจะแสดงที่นี่เมื่อเริ่มเขียน
                    </span>
                  )}
                </div>
              </article>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                ประกาศจะบันทึกและส่งถึงทุกบัญชีที่ยังใช้งานอยู่เมื่อกดเผยแพร่
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">ส่งถึงผู้ใช้งานทุกบัญชีที่ยังใช้งานอยู่</p>
            <button
              type="button"
              disabled={sending || !title.trim() || !body.trim()}
              onClick={() => void publish()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} />
              {sending ? "กำลังส่ง…" : "เผยแพร่ประกาศ"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
