import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { AlertTriangle, Trash2, X } from "lucide-react";
import axios from "axios";
import { clearUserData, previewUserClear, type UserClearPreview, type UserProfile } from "../../config/services/users.service";

function clearErrorMessage(error: unknown, deleting: boolean) {
  const code = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
  if (code === "clear_storage_bucket_not_found") return "ไม่พบ Firebase Storage bucket ของโครงการ กรุณาเปิด Storage ใน Firebase Console และตรวจ FIREBASE_STORAGE_BUCKET";
  if (code === "clear_storage_permission_denied") return "บัญชี service account ของ users-service ไม่มีสิทธิ์ดูหรือลบไฟล์ใน Storage bucket";
  if (code === "clear_storage_unavailable") return "เชื่อมต่อ Firebase Storage ไม่สำเร็จ กรุณาตรวจ bucket หรือสิทธิ์ Storage ของ users-service แล้วลองใหม่";
  if (code === "forbidden") return "บัญชีนี้ไม่มีสิทธิ์เคลียร์ข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่และตรวจสิทธิ์ supperAdmin";
  if (code === "clear_confirmation_mismatch") return "อีเมลยืนยันไม่ตรงกับบัญชีผู้ใช้";
  return deleting ? "เคลียร์ข้อมูลไม่สำเร็จ กรุณาตรวจ log ของ users-service แล้วลองอีกครั้ง" : "ตรวจสอบข้อมูลก่อนลบไม่ได้ กรุณาตรวจ log ของ users-service และการเชื่อมต่อ Firestore";
}

export default function UserClearDialog({ user, target, onClose, onCleared }: {
  user: User;
  target: UserProfile;
  onClose: () => void;
  onCleared: (profile: UserProfile) => void;
}) {
  const [preview, setPreview] = useState<UserClearPreview | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    previewUserClear(user, target.uid).then(value => {
      if (active) { setPreview(value); setLoading(false); }
    }).catch((cause: unknown) => {
      if (active) { setError(clearErrorMessage(cause, false)); setLoading(false); }
    });
    return () => { active = false; };
  }, [user, target.uid]);

  const clear = async () => {
    if (!preview || email.trim().toLocaleLowerCase() !== preview.email.toLocaleLowerCase()) return;
    setDeleting(true);
    setError("");
    try {
      const cleared = await clearUserData(user, target.uid, email.trim());
      onCleared(cleared);
    } catch (cause) {
      setError(clearErrorMessage(cause, true));
    } finally { setDeleting(false); }
  };

  return <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/70 p-3 sm:p-6" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="clear-user-title" className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"><AlertTriangle size={22} /></span>
        <button type="button" onClick={onClose} disabled={deleting} aria-label="ปิด" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X size={20} /></button>
      </div>
      <h2 id="clear-user-title" className="mt-4 text-xl font-bold text-slate-900 dark:text-white">เคลียร์ข้อมูลผู้ใช้ทั้งหมด</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{target.displayName || target.email} · {target.email}</p>
      {!loading && preview && <>
        <div className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><b className="block text-lg">{preview.budgetReports}</b>รายงาน</div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><b className="block text-lg">{preview.paymentRequests}</b>รายการชำระ</div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><b className="block text-lg">{preview.slipFiles}</b>ไฟล์สลิป</div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><b className="block text-lg">{preview.otherDocuments}</b>เอกสารอื่น</div>
        </div>
        <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">ลบข้อมูลการใช้งานใน Firestore และ Storage แล้วล้างข้อมูลส่วนตัวในโปรไฟล์ บัญชี Google/Firebase Auth ยังอยู่ แต่จะเข้าใช้งานระบบไม่ได้ หลักฐานการยอมรับข้อตกลงจะเก็บไว้แยกต่างหาก การลบนี้ย้อนกลับไม่ได้</p>
        <label className="mt-5 block text-sm font-semibold text-slate-800 dark:text-slate-200">พิมพ์อีเมล {preview.email} เพื่อยืนยัน<input autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></label>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={deleting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">ยกเลิก</button><button type="button" onClick={clear} disabled={!preview || deleting || email.trim().toLocaleLowerCase() !== preview.email.toLocaleLowerCase()} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Trash2 size={16} /> {deleting ? "กำลังเคลียร์…" : "เคลียร์ข้อมูลทั้งหมด"}</button></div>
    </section>
  </div>;
}
