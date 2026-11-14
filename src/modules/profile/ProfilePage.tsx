import { useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { CheckCircle2, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { updateProfile, type UserProfile } from "../../config/services/users.service";

type ProfileDetails = Pick<UserProfile, "displayName" | "email" | "phone" | "position" | "schoolName" | "role">;

export default function ProfilePage({ user, profile, onSaved }: {
  user: User;
  profile: ProfileDetails;
  onSaved: (profile: UserProfile) => void;
}) {
  const [form, setForm] = useState(() => ({
    displayName: profile.displayName || "",
    phone: profile.phone || "",
    position: profile.position === "SupperAdmin" ? "ผู้ดูแลระบบ" : profile.position || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const displayName = form.displayName.trim();
    const position = form.position.trim();
    const phone = form.phone.trim();
    if (!displayName || !position) { setError("กรุณากรอกชื่อและตำแหน่ง"); return; }
    if (displayName.length > 200 || position.length > 120 || phone.length > 40) { setError("ข้อมูลยาวเกินกำหนด กรุณาตรวจสอบอีกครั้ง"); return; }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await updateProfile(user, { displayName, phone, position, schoolName: profile.schoolName });
      onSaved(updated);
      setSaved(true);
    } catch {
      setError("บันทึกโปรไฟล์ไม่สำเร็จ กรุณาตรวจข้อมูลหรือการเชื่อมต่อแล้วลองใหม่");
    } finally { setSaving(false); }
  };

  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950";
  return <main className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-8">
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><UserRound size={27} /></span>
        <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">ข้อมูลบัญชีผู้ใช้</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ข้อมูลที่แสดงในระบบและเอกสารของคุณ</p></div>
      </div>
      <form onSubmit={(event) => { void submit(event); }} className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">ชื่อที่แสดง<input className={inputClass} value={form.displayName} maxLength={200} onChange={(event) => { setSaved(false); setForm((current) => ({ ...current, displayName: event.target.value })); }} required autoComplete="name" /></label>
          <label className="text-sm font-semibold">ตำแหน่ง<input className={inputClass} value={form.position} maxLength={120} onChange={(event) => { setSaved(false); setForm((current) => ({ ...current, position: event.target.value })); }} required placeholder="เช่น ครู หรือเจ้าหน้าที่การเงิน" /></label>
          <label className="text-sm font-semibold">เบอร์โทรศัพท์<input className={inputClass} value={form.phone} maxLength={40} onChange={(event) => { setSaved(false); setForm((current) => ({ ...current, phone: event.target.value })); }} type="tel" autoComplete="tel" placeholder="ไม่จำเป็นต้องกรอก" /></label>
          <div className="text-sm font-semibold">อีเมล Google<div className={`${inputClass} flex items-center gap-2 bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300`}><Mail size={17} className="shrink-0" /><span className="truncate">{profile.email || user.email}</span></div></div>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30"><div className="flex items-start gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-blue-600" /><div><p className="font-semibold">โรงเรียน: {profile.schoolName}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">หากต้องการย้ายบัญชีไปโรงเรียนอื่น โปรดติดต่อผู้ดูแลระบบเพื่ออนุมัติสิทธิ์เข้าถึงข้อมูล</p></div></div></div>
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={17} /> บันทึกโปรไฟล์แล้ว</p>}
        <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Save size={18} />{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button></div>
      </form>
    </section>
  </main>;
}
