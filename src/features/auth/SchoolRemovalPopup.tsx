import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { acknowledgeSchoolRemoval } from "../../config/services/school-team.service";

export default function SchoolRemovalPopup({ user, id, school }: { user: User; id: string; school: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  const acknowledge = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await acknowledgeSchoolRemoval(user, id);
      // Reload clears mounted finance components and starts registration with a fresh profile.
      window.location.replace("/");
    } catch {
      lock.current = false;
      setBusy(false);
      setError("บันทึกการรับทราบไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วกดตกลงอีกครั้ง");
    }
  };
  return <main className="min-h-dvh bg-slate-100 dark:bg-slate-950">
    <dialog ref={dialog} aria-labelledby="school-removal-title" aria-describedby="school-removal-description"
      onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border-0 bg-white p-6 text-slate-800 shadow-2xl backdrop:bg-slate-950/75 dark:bg-slate-900 dark:text-white sm:p-8">
      <h1 id="school-removal-title" className="text-xl font-bold">คุณถูกถอดออกจากทีมโรงเรียนแล้ว</h1>
      <p id="school-removal-description" className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
        บัญชีหลักได้ถอดคุณออกจาก{school ? ` ${school}` : "ทีมโรงเรียน"} คุณจึงไม่สามารถเข้าถึงข้อมูลโรงเรียนนี้ได้อีก
        บัญชี Google ของคุณยังใช้งานได้ กดตกลงเพื่อกลับไปหน้าลงทะเบียนข้อมูลเริ่มใช้งาน
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
      <button type="button" autoFocus disabled={busy} onClick={() => void acknowledge()}
        className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
        {busy ? "กำลังดำเนินการ…" : "ตกลง"}
      </button>
    </dialog>
  </main>;
}
