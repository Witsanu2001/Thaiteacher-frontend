import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Search, Trash2 } from "lucide-react";
import { listUsers, type UserProfile } from "../../config/services/users.service";
import AdminHeader from "../../shared/components/AdminHeader";
import UserClearDialog from "./UserClearDialog";

const dateText = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
  : "—";

export default function AdminClearPage({ user, onMenu, dark, onToggleDark }: {
  user: User;
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<UserProfile | null>(null);

  useEffect(() => {
    let active = true;
    listUsers(user).then(items => { if (active) setUsers(items); })
      .catch(() => { if (active) setError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ กรุณาตรวจสิทธิ์ supperAdmin และ users-service"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  const candidates = useMemo(() => users.filter(item => item.uid !== user.uid && item.status !== "cleared"), [users, user.uid]);
  const visible = useMemo(() => candidates.filter(item => `${item.displayName} ${item.email} ${item.schoolName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [candidates, query]);
  const cleared = useMemo(() => users.filter(item => item.status === "cleared"), [users]);
  const onCleared = (profile: UserProfile) => {
    setUsers(items => items.map(item => item.uid === profile.uid ? profile : item));
    setTarget(null);
  };

  return <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <AdminHeader title="เคลียร์ข้อมูลผู้ใช้" onMenu={onMenu} dark={dark} onToggleDark={onToggleDark} />
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <section data-tour="admin-clear-warning" className="rounded-2xl border border-rose-200 bg-white p-5 dark:border-rose-900 dark:bg-slate-900">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950"><Trash2 size={21} /></span><div><h2 className="font-semibold">เลือกบัญชีที่ต้องการเคลียร์</h2><p className="text-sm text-slate-500">ตรวจจำนวนรายงาน รายการชำระ และไฟล์สลิปก่อนยืนยันลบ</p></div></div>
        <label className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700"><Search size={18} className="text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อ อีเมล หรือโรงเรียน" className="w-full bg-transparent py-3 text-sm outline-none" /></label>
      </section>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? null : visible.length === 0 ? <p className="p-6 text-sm text-slate-500">ไม่พบบัญชีที่เคลียร์ได้</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{visible.map(item => <div key={item.uid} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5"><div className="min-w-0"><b className="block truncate">{item.displayName || item.email}</b><p className="truncate text-xs text-slate-500">{item.email} · {item.schoolName || "ไม่ระบุโรงเรียน"}</p></div><button type="button" onClick={() => setTarget(item)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950">ตรวจข้อมูลก่อนเคลียร์</button></div>)}</div>}
      </section>
      {cleared.length > 0 && <details className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold">บัญชีที่เคลียร์แล้ว · {cleared.length} บัญชี</summary><div className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">{cleared.map(item => <div key={item.uid} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span>รหัสบัญชี <code className="text-xs">{item.uid}</code></span><span className="text-xs text-slate-500">เคลียร์เมื่อ {dateText(item.clearedAt)}</span></div>)}</div></details>}
    </main>
    {target && <UserClearDialog user={user} target={target} onClose={() => setTarget(null)} onCleared={onCleared} />}
  </div>;
}
