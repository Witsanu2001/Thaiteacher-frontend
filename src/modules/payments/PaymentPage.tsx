import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { ArrowLeft, Check, CheckCircle2, Clock3, Download, FileCheck2, FileText, ImagePlus, Loader2, LogOut, RefreshCw, ShieldCheck, UploadCloud, X } from "lucide-react";
import { getPaymentQuote, type PaymentQuote, getPaymentRequests, type PaymentRequest } from "../../config/services/payments.service";
import { paymentConfig } from "./paymentConfig";
import { newPaymentAttempt, submitPayment, validateSlip, type PaymentAttempt, type ValidatedSlip } from "./paymentSubmission";

type Props = {
  user: User;
  profile: { displayName: string; email: string; schoolName: string };
  accessLabel: string;
  accessState: "trial" | "paid" | "lifetime" | "expired";
  onBack?: () => void;
  onSignOut: () => void;
  onRefreshAccess: () => Promise<void>;
};
const statusLabels = { pending: "รอตรวจสอบ", approved: "ตรวจสอบแล้ว", rejected: "ไม่ผ่านการตรวจสอบ" } as const;
const statusColors = { pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" } as const;

export default function PaymentPage({ user, profile, accessLabel, accessState, onBack, onSignOut, onRefreshAccess }: Props) {
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const price = (quote?.amountSatang || 0) / 100;
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [slip, setSlip] = useState<(ValidatedSlip & { preview: string }) | null>(null);
  const [validating, setValidating] = useState(false);
  const [stage, setStage] = useState<"uploading" | "submitting" | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const attempt = useRef<PaymentAttempt | null>(null);
  const busy = useRef(false);
  const selection = useRef(0);
  const pending = payments.find(payment => payment.status === "pending");
  const submitting = stage !== null;

  const load = useCallback(async () => {
    setLoading(true);
    setHistoryError("");
    try { const [items, pricing] = await Promise.all([getPaymentRequests(user, true), getPaymentQuote(user)]); setPayments(items); setQuote(pricing); }
    catch { setHistoryError("โหลดประวัติการชำระเงินไม่สำเร็จ กรุณาลองใหม่ก่อนส่งสลิป"); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => {
    let active = true;
    void Promise.all([getPaymentRequests(user), getPaymentQuote(user)])
      .then(([items, pricing]) => { if (active) { setPayments(items); setQuote(pricing); } })
      .catch(() => { if (active) setHistoryError("โหลดประวัติการชำระเงินไม่สำเร็จ กรุณาลองใหม่ก่อนส่งสลิป"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => () => { if (slip?.preview) URL.revokeObjectURL(slip.preview); }, [slip]);

  const chooseFile = async (file: File) => {
    if (busy.current) return;
    const current = ++selection.current;
    setValidating(true); setError(""); setSuccess(false);
    try {
      const checked = await validateSlip(file);
      if (current !== selection.current) return;
      setSlip({ ...checked, preview: checked.contentType.startsWith("image/") ? URL.createObjectURL(file) : "" });
      attempt.current = null;
      setConfirmed(false);
    } catch (cause) {
      if (current === selection.current) setError(cause instanceof Error ? cause.message : "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ใหม่");
    } finally { if (current === selection.current) setValidating(false); }
  };
  const changeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (file) void chooseFile(file);
  };
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!quote || price <= 0 || !slip || !confirmed || busy.current || pending || loading || historyError || validating) return;
    busy.current = true; setError(""); setStage("uploading");
    try {
      attempt.current ||= newPaymentAttempt(user.uid, slip, price);
      const payment = await submitPayment(user, attempt.current, setStage);
      setPayments(items => [payment, ...items.filter(item => item.id !== payment.id)]);
      setSuccess(true); setSlip(null); setConfirmed(false); attempt.current = null;
    } catch (cause) {
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : "";
      setError(code === "storage/unauthorized"
        ? "ระบบจัดเก็บไฟล์ปฏิเสธสิทธิ์ส่งสลิป (403) รายการยังส่งไม่สำเร็จ กรุณาติดต่อทีมงานเพื่อตรวจสิทธิ์อัปโหลด"
        : code === "storage/unauthenticated"
          ? "เซสชันเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วส่งสลิปอีกครั้ง"
          : "ส่งสลิปไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วกดส่งอีกครั้ง ระบบจะใช้รายการเดิมเพื่อป้องกันการส่งซ้ำ");
    } finally { setStage(null); busy.current = false; }
  };
  const refresh = async () => {
    await load();
    try { await onRefreshAccess(); } catch { setHistoryError("ตรวจสอบสถานะแพ็กเกจไม่สำเร็จ กรุณาลองใหม่"); }
  };

  return <div className="min-h-dvh bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">{onBack && <button type="button" onClick={onBack} aria-label="กลับเข้าระบบ" className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><ArrowLeft size={20} /></button>}<div><p className="text-xs font-bold tracking-wide text-blue-600 dark:text-blue-300">ThaiTeacher</p><h1 className="text-lg font-bold sm:text-xl">แพ็กเกจและชำระเงิน</h1></div></div>
        <button type="button" aria-label="ออกจากระบบ" onClick={() => { if (window.confirm("ต้องการออกจากระบบหรือไม่?")) onSignOut(); }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><LogOut size={17} /><span className="hidden sm:inline">ออกจากระบบ</span></button>
      </div>
    </header>
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/40">
        <div className="min-w-0"><p className="truncate font-semibold">{profile.schoolName}</p><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{profile.displayName} · {profile.email || user.email}</p></div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-300">{accessLabel}</span>
      </section>
      {!quote ? <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><p role="status">{loading ? "กำลังโหลดราคาประจำบัญชี…" : "ยังโหลดราคาประจำบัญชีไม่สำเร็จ กรุณาลองใหม่ก่อนโอนเงิน"}</p><button type="button" className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-white disabled:opacity-50" disabled={loading} onClick={() => { void load(); }}>โหลดราคาและประวัติใหม่</button></section> : quote?.billingMode === "sponsored" ? <section className="rounded-2xl border border-blue-200 bg-white p-6 dark:border-blue-900 dark:bg-slate-900"><h2 className="text-xl font-bold">ใช้สิทธิ์จากบัญชีหลัก</h2><p className="mt-3">คุณไม่ต้องชำระเองในรูปแบบนี้ สิทธิ์ใช้งานขึ้นอยู่กับแพ็กเกจชำระเงินของบัญชีหลัก หากต้องการจ่ายเอง ให้เลือกที่เมนูฟันเฟือง → สมาชิกโรงเรียน</p><button className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-white" onClick={onBack}>กลับเข้าระบบ</button></section> : accessState === "lifetime" ? <section className="rounded-2xl border border-emerald-200 bg-white p-6 dark:border-emerald-900 dark:bg-slate-900"><ShieldCheck className="mb-3 text-emerald-600" size={28} /><h2 className="text-xl font-bold">บัญชีของคุณใช้งานฟรีตลอดชีพ</h2><p className="mt-2 text-slate-500">คุณใช้งานต่อได้โดยไม่ต้องชำระเงิน</p>{onBack && <button type="button" onClick={onBack} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">กลับเข้าระบบ</button>}</section> : <>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6"><p className="text-sm font-semibold text-blue-600 dark:text-blue-300">ใช้งานระบบการเงินโรงเรียน</p><div className="mt-2 flex items-baseline gap-2"><strong className="text-4xl font-bold tracking-tight">{quote ? price.toLocaleString("th-TH", {maximumFractionDigits:2}) : "…"}<span className="ml-1 text-lg font-semibold">บาท</span></strong><span className="text-sm text-slate-500">/ {paymentConfig.duration}</span></div><p className="mt-2 text-xs text-slate-500">ราคาประจำบัญชีของคุณ ล็อกตามสิทธิ์ที่ได้รับ · ต่ออายุรายเดือน ไม่มีการตัดเงินอัตโนมัติ</p></div>
            <ul className="space-y-3 px-5 py-5 text-sm sm:px-6">{paymentConfig.benefits.map(benefit => <li key={benefit} className="flex items-start gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /><span>{benefit}</span></li>)}</ul>
            <div className="border-t border-slate-100 bg-slate-50/60 p-5 text-center dark:border-slate-800 dark:bg-slate-800/30 sm:p-6"><h2 className="flex items-center justify-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">1</span>สแกน QR เพื่อชำระเงิน</h2><p className="mt-1 text-sm text-slate-500">เปิดแอปธนาคาร แล้วโอน {price} บาท</p><img src={paymentConfig.qr} alt="QR รับชำระเงิน ThaiTeacher บัญชีกรรณิกา คงเทพ" className="mx-auto mt-4 h-auto w-full max-w-[280px] rounded-xl bg-white shadow-sm" /><a href={paymentConfig.qr} download="ThaiTeacher-QR-payment.jpg" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300"><Download size={17} />บันทึกรูป QR</a><p className="mt-3 text-xs text-slate-500">ตรวจชื่อผู้รับเงิน กรรณิกา คงเทพ ก่อนยืนยันโอน</p></div>
          </section>
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold"><span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">2</span>แนบสลิปและแจ้งชำระเงิน</h2><p className="mt-2 text-sm leading-6 text-slate-500">หลังโอนเงิน เลือกสลิปจากรูปภาพหรือไฟล์ในเครื่อง แล้วส่งให้ผู้ดูแลตรวจสอบ</p>
              {success && <div role="status" className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 size={22} className="shrink-0" /><div><p className="font-semibold">ส่งสลิปเรียบร้อยแล้ว</p><p className="mt-1 text-sm">รายการอยู่ระหว่างตรวจสอบ การแนบสลิปยังไม่เปิดใช้งานแพ็กเกจทันที</p></div></div>}
              {pending ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300"><Clock3 size={19} />มีรายการรอตรวจสอบ</p><p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200">ส่งยอด {pending.amount.toLocaleString("th-TH", {minimumFractionDigits:2})} บาทแล้ว ไม่ต้องโอนหรือส่งสลิปซ้ำ</p><button type="button" disabled={loading} onClick={() => void refresh()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-amber-800 shadow-sm disabled:opacity-50 dark:bg-slate-800 dark:text-amber-300"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />ตรวจสอบสถานะ</button></div> : <form onSubmit={event => { void send(event); }} className="mt-5 space-y-4">
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" onChange={changeFile} disabled={submitting || validating} aria-label="เลือกสลิปโอนเงิน" className="sr-only" />
                {!slip ? <button type="button" disabled={submitting || validating || loading || Boolean(historyError)} onClick={() => fileInput.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!loading && !historyError && event.dataTransfer.files[0]) void chooseFile(event.dataTransfer.files[0]); }} className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-50 ${dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-blue-200 bg-blue-50/40 hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950/20"}`}><ImagePlus size={29} className="text-blue-500" /><span className="font-semibold text-blue-700 dark:text-blue-300">{validating ? "กำลังตรวจไฟล์…" : "แตะเพื่อเลือกสลิป"}</span><span className="text-xs leading-5 text-slate-500">หรือลากไฟล์มาวาง · JPG, PNG, WebP, PDF<br />ขนาดน้อยกว่า 10 MB</span></button> : <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">{slip.preview && <img src={slip.preview} alt="ตัวอย่างสลิปที่เลือก" className="max-h-72 w-full bg-slate-50 object-contain dark:bg-slate-800" />}<div className="flex items-center gap-3 p-3"><FileText size={22} className="shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{slip.file.name}</p><p className="text-xs text-slate-500">{(slip.file.size / 1024 / 1024).toFixed(2)} MB</p></div><button type="button" disabled={submitting} aria-label="ลบสลิปที่เลือก" onClick={() => { selection.current++; setSlip(null); attempt.current = null; setConfirmed(false); }} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><X size={18} /></button></div></div>}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800"><span className="text-slate-500">ยอดชำระสำหรับ {paymentConfig.duration}</span><strong className="text-lg tabular-nums">{price.toFixed(2)} บาท</strong></div>
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={submitting} className="mt-1 size-4 shrink-0 accent-blue-600" /><span>ฉันโอนเงิน {price} บาทแล้ว และตรวจสอบว่าสลิปถูกต้อง</span></label>
                {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
                <button type="submit" disabled={!quote || price <= 0 || !slip || !confirmed || submitting || validating || loading || Boolean(historyError)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 size={19} className="animate-spin" /> : <UploadCloud size={19} />}{stage === "uploading" ? "กำลังอัปโหลดสลิป…" : stage === "submitting" ? "กำลังส่งข้อมูล…" : "ส่งสลิปให้ตรวจสอบ"}</button>
                <p className="text-center text-xs leading-5 text-slate-500">ผู้ดูแลจะตรวจสอบยอดและสลิปก่อนเปิดใช้งานแพ็กเกจ</p>
              </form>}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><FileCheck2 size={19} className="text-blue-500" />ประวัติการแจ้งชำระเงิน</h2><button type="button" onClick={() => void refresh()} disabled={loading || submitting} aria-label="รีเฟรชสถานะการชำระเงิน" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><RefreshCw size={17} className={loading ? "animate-spin" : ""} /></button></div>
              {historyError ? <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">{historyError}</p> : loading ? <div role="status" aria-label="กำลังโหลดประวัติการชำระเงิน" className="grid min-h-24 place-items-center"><Loader2 size={23} className="animate-spin text-blue-500" /></div> : payments.length ? <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{payments.map(payment => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-semibold tabular-nums">{payment.amount.toLocaleString("th-TH", {minimumFractionDigits:2})} บาท</p><p className="mt-1 text-xs text-slate-500">{new Date(payment.submittedAt).toLocaleString("th-TH", { dateStyle:"medium", timeStyle:"short" })}</p>{payment.reviewNote && <p className="mt-1 max-w-sm break-words text-xs text-slate-500">หมายเหตุ: {payment.reviewNote}</p>}{payment.activatedUntil && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">ใช้งานถึง {new Date(payment.activatedUntil).toLocaleDateString("th-TH", {timeZone:"Asia/Bangkok"})}</p>}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[payment.status]}`}>{statusLabels[payment.status]}</span></li>)}</ul> : <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีรายการแจ้งชำระเงิน</p>}
            </section>
          </div>
        </div>
      </>}
    </main>
  </div>;
}
