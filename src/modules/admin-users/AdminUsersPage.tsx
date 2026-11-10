import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Eye, Pencil, Search, Users, X } from "lucide-react";
import {
  adminUpdateUser,
  listUsers,
  type AdminUserUpdate,
  type UserPlan,
  type UserProfile,
} from "../../config/services/users.service";
import AdminHeader from "../../shared/components/AdminHeader";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const planName: Record<UserPlan, string> = {
  trial: "ทดลองใช้",
  paid: "ชำระเงิน",
  lifetime: "ฟรีตลอดชีพ",
};
const dateText = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const dateInputValue = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "";

function statusOf(profile: UserProfile, now: number) {
  if (profile.status === "cleared")
    return {
      text: "เคลียร์ข้อมูลแล้ว",
      color:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    };
  if (profile.status === "clearing")
    return {
      text: "กำลังเคลียร์ข้อมูล",
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
  const plan = profile.plan || (profile.paidUntil ? "paid" : "trial");
  if (plan === "lifetime")
    return {
      text: "ฟรีตลอดชีพ",
      color:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    };
  const until =
    plan === "paid"
      ? new Date(profile.paidUntil || "").getTime()
      : new Date(profile.createdAt || "").getTime() + 30 * 86400000;
  const days = Math.max(0, Math.ceil((until - now) / 86400000));
  if (Number.isFinite(until) && until > now)
    return {
      text:
        plan === "paid"
          ? `ชำระเงิน · เหลือ ${days} วัน`
          : `ทดลองใช้ · เหลือ ${days} วัน`,
      color:
        plan === "paid"
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          : "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    };
  return {
    text: plan === "paid" ? "แพ็กเกจชำระเงินหมดอายุ" : "ทดลองใช้หมดอายุ",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
}

export default function AdminUsersPage({
  user,
  onMenu,
  onView,
  viewBusy = false,
  dark,
  onToggleDark,
}: {
  user: User;
  onMenu: () => void;
  onView: (profile: UserProfile) => void;
  viewBusy?: boolean;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<AdminUserUpdate | null>(null);
  const [saving, setSaving] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    listUsers(user)
      .then((items) => {
        if (!cancelled) {
          setUsers(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "โหลดรายชื่อผู้ใช้ไม่สำเร็จ หรือบัญชีนี้ไม่มีสิทธิ์ SupperAdmin",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const activeUsers = useMemo(
    () => users.filter((item) => item.status !== "cleared"),
    [users],
  );
  const filtered = useMemo(
    () =>
      activeUsers.filter((item) =>
        `${item.displayName} ${item.email} ${item.schoolName} ${item.position}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase().trim()),
      ),
    [activeUsers, query],
  );
  const beginEdit = (item: UserProfile) => {
    setEditing(item);
    setDraft({
      displayName: item.displayName,
      phone: item.phone,
      position: item.position === "SupperAdmin" ? "" : item.position,
      role: item.role || "user",
      schoolName: item.schoolName,
      plan:
        item.plan === "inactive"
          ? "trial"
          : item.plan || (item.paidUntil ? "paid" : "trial"),
      paidUntil: item.paidUntil,
    });
    setError("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !draft) return;
    if (draft.plan === "paid" && !draft.paidUntil) {
      setError("เลือกวันสิ้นสุดแพ็กเกจชำระเงิน");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await adminUpdateUser(user, editing.uid, draft);
      setUsers((current) =>
        current.map((item) => (item.uid === updated.uid ? updated : item)),
      );
      setEditing(null);
      setDraft(null);
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ ตรวจสอบข้อมูลแพ็กเกจและสิทธิ์ผู้ดูแล");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <AdminHeader
        title="จัดการผู้ใช้งาน"
        onMenu={onMenu}
        dark={dark}
        onToggleDark={onToggleDark}
      />
      <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950">
              <Users size={21} />
            </span>
            <div>
              <h2 className="font-semibold">ผู้ใช้งาน</h2>
              <p className="text-sm text-slate-500">
                {loading ? "กำลังโหลด…" : `${activeUsers.length} บัญชี`}
              </p>
            </div>
          </div>
          <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700 sm:w-80">
            <Search size={18} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ อีเมล หรือโรงเรียน"
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </label>
        </section>
        {error && !editing && (
          <p
            role="alert"
            className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          >
            {error}
          </p>
        )}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-500">
              กำลังโหลดรายชื่อผู้ใช้…
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              ไม่พบผู้ใช้
            </p>
          ) : (
            <>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                {filtered.map((item) => {
                  const status = statusOf(item, now);
                  return (
                    <article key={item.uid} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <b className="block truncate">
                            {item.displayName || "ยังไม่กรอกชื่อ"}
                          </b>
                          <span className="block truncate text-xs text-slate-500">
                            {item.email}
                          </span>
                        </div>
                        <button
                          disabled={
                            viewBusy ||
                            item.uid === user.uid ||
                            item.status === "cleared" ||
                            item.status === "clearing"
                          }
                          onClick={() => onView(item)}
                          aria-label={`สวมสิทธิ์ ${item.displayName}`}
                          className="shrink-0 rounded-lg border border-blue-200 p-2 text-blue-700 disabled:opacity-40 dark:border-blue-900 dark:text-blue-300"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          disabled={
                            item.status === "cleared" ||
                            item.status === "clearing"
                          }
                          onClick={() => beginEdit(item)}
                          aria-label={`แก้ไข ${item.displayName}`}
                          className="shrink-0 rounded-lg border border-blue-200 p-2 text-blue-700 dark:border-blue-900 dark:text-blue-300"
                        >
                          <Pencil size={17} />
                        </button>
                      </div>
                      <p className="text-sm">
                        {item.schoolName || "—"}{" "}
                        <span className="text-slate-400">·</span>{" "}
                        {item.position || "—"}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}
                        >
                          {status.text}
                        </span>
                        <span className="text-xs text-slate-500">
                          {dateText(item.createdAt)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-5 py-4">ผู้ใช้</th>
                      <th className="px-5 py-4">โรงเรียน / ตำแหน่ง</th>
                      <th className="px-5 py-4">แพ็กเกจ</th>
                      <th className="px-5 py-4">เริ่มใช้งาน</th>
                      <th className="px-5 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((item) => {
                      const status = statusOf(item, now);
                      return (
                        <tr
                          key={item.uid}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-5 py-4">
                            <b className="block font-semibold">
                              {item.displayName || "ยังไม่กรอกชื่อ"}
                            </b>
                            <span className="text-xs text-slate-500">
                              {item.email}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="block">
                              {item.schoolName || "—"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.position || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}
                            >
                              {status.text}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-500">
                            {dateText(item.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              disabled={
                                viewBusy ||
                                item.uid === user.uid ||
                                item.status === "cleared" ||
                                item.status === "clearing"
                              }
                              onClick={() => onView(item)}
                              className="mr-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 disabled:opacity-40 dark:border-blue-900 dark:text-blue-300"
                            >
                              <Eye size={15} /> สวมสิทธิ์
                            </button>
                            <button
                              disabled={
                                item.status === "cleared" ||
                                item.status === "clearing"
                              }
                              onClick={() => beginEdit(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"
                            >
                              <Pencil size={15} /> แก้ไข
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
      {editing && draft && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <form
            onSubmit={save}
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-600">
                  แก้ไขผู้ใช้งาน
                </p>
                <h2 className="text-xl font-bold">
                  {editing.displayName || editing.email}
                </h2>
                <p className="text-xs text-slate-500">{editing.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="ปิด"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                ชื่อ–นามสกุล
                <input
                  required
                  className={inputClass}
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft({ ...draft, displayName: e.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                เบอร์โทรศัพท์
                <input
                  className={inputClass}
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                ตำแหน่ง
                <input
                  required
                  className={inputClass}
                  value={draft.position}
                  onChange={(e) =>
                    setDraft({ ...draft, position: e.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                โรงเรียน
                <input
                  required
                  className={inputClass}
                  value={draft.schoolName}
                  onChange={(e) =>
                    setDraft({ ...draft, schoolName: e.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                แพ็กเกจ
                <select
                  className={inputClass}
                  value={draft.plan}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      plan: e.target.value as UserPlan,
                      paidUntil:
                        e.target.value === "paid" ? draft.paidUntil : null,
                    })
                  }
                >
                  <option value="trial">{planName.trial}</option>
                  <option value="paid">{planName.paid}</option>
                  <option value="lifetime">{planName.lifetime}</option>
                </select>
              </label>
              {draft.plan === "paid" && (
                <label className="text-sm font-medium">
                  ใช้ได้ถึงวันที่
                  <input
                    required
                    type="date"
                    className={inputClass}
                    value={dateInputValue(draft.paidUntil)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        paidUntil: e.target.value
                          ? `${e.target.value}T23:59:59+07:00`
                          : null,
                      })
                    }
                  />
                </label>
              )}
            </div>
            <label className="mt-4 block text-sm font-medium">
              สิทธิ์การใช้งาน
              <select
                className={inputClass}
                value={draft.role}
                disabled={editing.uid === user.uid}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    role: e.target.value as AdminUserUpdate["role"],
                  })
                }
              >
                <option value="user">ผู้ใช้งานทั่วไป</option>
                <option value="supperAdmin">ผู้ดูแลระบบ</option>
              </select>
            </label>
            <p className="mt-4 text-xs text-slate-500">
              วันเริ่มใช้งาน: {dateText(editing.createdAt)} · รหัสผู้ใช้:{" "}
              {editing.uid}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700"
              >
                ยกเลิก
              </button>
              <button
                disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
