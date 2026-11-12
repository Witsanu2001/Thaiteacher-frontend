import { useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import type { User } from "firebase/auth";
import {
  replyToConversation,
} from "../../config/services/customer.service";
import type { UserProfile } from "../../config/services/users.service";

type RecipientMode = "all_users" | "current_school" | "selected_users";
type Props = {
  user: User;
  profiles: UserProfile[];
  profilesLoading: boolean;
  profilesError: string;
  onClose: () => void;
  onSent: () => void;
};

const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function BroadcastSupportMessageDialog({
  user,
  profiles,
  profilesLoading,
  profilesError,
  onClose,
  onSent,
}: Props) {
  const [recipientMode, setRecipientMode] =
    useState<RecipientMode>("selected_users");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [sentUserIds, setSentUserIds] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const eligibleUsers = useMemo(
    () =>
      profiles
        .filter(
          (profile) =>
            profile.role === "user" &&
            profile.status !== "clearing" &&
            profile.status !== "cleared",
        )
        .sort((a, b) =>
          (a.displayName || a.email).localeCompare(b.displayName || b.email),
        ),
    [profiles],
  );
  const schools = useMemo(
    () =>
      [...new Set(eligibleUsers.map((profile) => profile.schoolName.trim()))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [eligibleUsers],
  );
  const school = schools.includes(selectedSchool)
    ? selectedSchool
    : schools[0] || "";
  const filteredUsers = eligibleUsers.filter((profile) =>
    `${profile.displayName} ${profile.email} ${profile.schoolName}`
      .toLocaleLowerCase()
      .includes(userSearch.trim().toLocaleLowerCase()),
  );
  const recipients = useMemo(() => {
    if (recipientMode === "all_users") return eligibleUsers;
    if (recipientMode === "current_school") {
      return eligibleUsers.filter((profile) => profile.schoolName === school);
    }
    return eligibleUsers.filter((profile) =>
      selectedUserIds.includes(profile.uid),
    );
  }, [eligibleUsers, recipientMode, school, selectedUserIds]);
  const remainingRecipients = recipients.filter(
    (profile) => !sentUserIds.includes(profile.uid),
  );
  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((profile) => selectedUserIds.includes(profile.uid));

  const requestAi = async (mode: "draft" | "formalize") => {
    const source = mode === "draft" ? aiPrompt.trim() : draft.trim();
    if (!source || aiBusy) return;
    setAiBusy(true);
    setError("");
    setResultMessage("");
    const message =
      mode === "draft"
        ? `ช่วยร่างข้อความแชทภาษาไทยที่สุภาพและเป็นทางการสำหรับส่งจากทีมบริการลูกค้า ThaiTeacher โดยยึดรายละเอียดนี้ ห้ามแต่งข้อเท็จจริงเพิ่ม และส่งกลับเฉพาะข้อความที่พร้อมส่ง:\n${source}`
        : `ปรับข้อความต่อไปนี้ให้สุภาพและเป็นทางการขึ้น โดยรักษาความหมายและข้อเท็จจริงเดิม ห้ามเพิ่มข้อมูลใหม่ และส่งกลับเฉพาะข้อความที่ปรับแล้ว:\n${source}`;

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
      setDraft(payload.reply.trim());
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

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || remainingRecipients.length === 0 || sending) return;
    const confirmed = window.confirm(
      `ยืนยันส่งข้อความส่วนตัวถึง ${remainingRecipients.length} คนหรือไม่?`,
    );
    if (!confirmed) return;

    setSending(true);
    setError("");
    setResultMessage("");
    setProgress({ done: 0, total: remainingRecipients.length });
    const sentThisTime: string[] = [];
    const failedNames: string[] = [];

    try {
      for (let index = 0; index < remainingRecipients.length; index += 5) {
        const batch = remainingRecipients.slice(index, index + 5);
        const results = await Promise.allSettled(
          batch.map((profile) =>
            replyToConversation(user, profile.uid, text),
          ),
        );
        results.forEach((result, resultIndex) => {
          if (result.status === "fulfilled") {
            sentThisTime.push(batch[resultIndex].uid);
          } else {
            failedNames.push(
              batch[resultIndex].displayName ||
                batch[resultIndex].email ||
                batch[resultIndex].uid,
            );
          }
        });
        setSentUserIds((current) => [...new Set([...current, ...sentThisTime])]);
        setProgress({
          done: Math.min(index + batch.length, remainingRecipients.length),
          total: remainingRecipients.length,
        });
      }

      if (sentThisTime.length > 0) onSent();
      setResultMessage(
        `ส่งสำเร็จ ${sentThisTime.length} จาก ${remainingRecipients.length} คน`,
      );
      if (failedNames.length > 0) {
        setError(
          `ส่งไม่สำเร็จ ${failedNames.length} คน: ${failedNames.slice(0, 3).join(", ")}${failedNames.length > 3 ? "…" : ""} กดส่งอีกครั้งเพื่อส่งเฉพาะผู้ที่ยังไม่สำเร็จ`,
        );
      }
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending && !aiBusy) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-support-title"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <MessageCircle size={21} />
            </span>
            <div>
              <h2 id="broadcast-support-title" className="font-bold">
                ส่งข้อความส่วนตัวหลายคน
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                แต่ละคนจะได้รับเป็นบทสนทนาส่วนตัว
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending || aiBusy}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={(event) => void send(event)} className="min-h-0 overflow-y-auto">
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">เลือกผู้รับ</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["selected_users", "เลือกบางคน"],
                  ["current_school", "ทั้งโรงเรียน"],
                  ["all_users", "ทุกคน"],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={sending}
                    onClick={() => setRecipientMode(mode)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${recipientMode === mode ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {recipientMode === "current_school" && (
                <label className="grid gap-1.5 text-xs font-medium text-slate-500">
                  โรงเรียน
                  <select
                    value={school}
                    onChange={(event) => setSelectedSchool(event.target.value)}
                    disabled={sending || profilesLoading || schools.length === 0}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {schools.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>
              )}

              {recipientMode === "selected_users" && (
                <div className="space-y-2">
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    disabled={sending || profilesLoading}
                    placeholder="ค้นหาชื่อ อีเมล หรือโรงเรียน"
                    aria-label="ค้นหาผู้รับ"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={sending || filteredUsers.length === 0}
                    onClick={() =>
                      setSelectedUserIds((current) =>
                        allFilteredSelected
                          ? current.filter(
                              (id) =>
                                !filteredUsers.some(
                                  (profile) => profile.uid === id,
                                ),
                            )
                          : [
                              ...new Set([
                                ...current,
                                ...filteredUsers.map((profile) => profile.uid),
                              ]),
                            ],
                      )
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50 dark:text-blue-300"
                  >
                    {allFilteredSelected ? "ยกเลิกที่แสดง" : "เลือกที่แสดงทั้งหมด"}
                  </button>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                    {profilesLoading ? (
                      <p className="p-3 text-sm text-slate-500">กำลังโหลดรายชื่อ…</p>
                    ) : profilesError ? (
                      <p role="alert" className="p-3 text-sm text-rose-600">{profilesError}</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="p-3 text-sm text-slate-500">ไม่พบผู้ใช้</p>
                    ) : filteredUsers.map((profile) => (
                      <label
                        key={profile.uid}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(profile.uid)}
                          disabled={sending}
                          onChange={(event) =>
                            setSelectedUserIds((current) =>
                              event.target.checked
                                ? [...current, profile.uid]
                                : current.filter((id) => id !== profile.uid),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {profile.displayName || profile.email}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {profile.schoolName || profile.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {profilesError && recipientMode !== "selected_users" && (
                <p role="alert" className="text-sm text-rose-600">{profilesError}</p>
              )}
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                ผู้รับ {recipients.length} คน
                {sentUserIds.length > 0 && ` · ส่งแล้ว ${sentUserIds.length} คน`}
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">เขียนข้อความ</h3>
              <label className="grid gap-1.5 text-xs font-medium text-slate-500">
                ให้ AI ช่วยร่างจากรายละเอียด
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  disabled={aiBusy || sending}
                  rows={2}
                  maxLength={1000}
                  placeholder="เช่น แจ้งปิดปรับปรุงระบบวันเสาร์ เวลา 20:00 น."
                  className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void requestAi("draft")}
                  disabled={aiBusy || sending || !aiPrompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950"
                >
                  {aiBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  ร่างข้อความด้วย AI
                </button>
                <button
                  type="button"
                  onClick={() => void requestAi("formalize")}
                  disabled={aiBusy || sending || !draft.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950"
                >
                  <Sparkles size={14} />
                  ปรับให้เป็นทางการ
                </button>
              </div>
              <label className="grid gap-1.5 text-xs font-medium text-slate-500">
                ข้อความที่จะส่ง
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={aiBusy || sending}
                  rows={6}
                  maxLength={4000}
                  placeholder="เขียนข้อความ หรือให้ AI ช่วยร่างก่อนส่ง"
                  className="resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </section>
          </div>

          <footer className="space-y-2 border-t border-slate-100 p-5 dark:border-slate-800">
            {sending && (
              <p role="status" className="text-xs text-slate-500">
                กำลังส่ง {progress.done} จาก {progress.total} คน…
              </p>
            )}
            {resultMessage && (
              <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {resultMessage}
              </p>
            )}
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending || aiBusy}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                ปิด
              </button>
              <button
                type="submit"
                disabled={
                  sending ||
                  aiBusy ||
                  profilesLoading ||
                  Boolean(profilesError) ||
                  !draft.trim() ||
                  remainingRecipients.length === 0
                }
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                ส่งส่วนตัว {remainingRecipients.length} คน
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
