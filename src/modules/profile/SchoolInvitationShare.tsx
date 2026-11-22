import { useEffect, useState } from "react";
import { Check, Copy, Download, Link, QrCode } from "lucide-react";
import { schoolInvitationLink } from "../../shared/funtion/schoolInvitationLink";
export default function SchoolInvitationShare({ token, email, expiresAt }: { token: string; email: string; expiresAt: string }) {
 const link = schoolInvitationLink(token, window.location.origin);
 const [qr, setQr] = useState("");
 const [qrError, setQrError] = useState(false);
 const [copied, setCopied] = useState(false);
 const [copyError, setCopyError] = useState(false);
 useEffect(() => {
  let active = true;
  void import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 512, margin: 4, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } }))
   .then(value => { if (active) setQr(value); }).catch(() => { if (active) setQrError(true); });
  return () => { active = false; };
 }, [link]);
 const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700";
 return <section className="grid gap-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/40 sm:p-5 lg:grid-cols-[minmax(0,1fr)_240px]">
  <div className="min-w-0 space-y-3"><h3 className="flex items-center gap-2 font-bold"><Link size={19} />ลิงก์เชิญพร้อมส่ง</h3><p className="break-all font-medium">สำหรับ {email}</p><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">ส่งลิงก์ทางแชทส่วนตัว หรือให้ผู้รับสแกน QR แล้วเข้าสู่ระบบด้วยอีเมลที่เชิญ ระบบจะพาไปตรวจชื่อโรงเรียนและรูปแบบชำระที่กำหนดไว้ก่อนยืนยัน</p>
   <label className="block text-sm font-semibold">ลิงก์คำเชิญ<input aria-label="ลิงก์คำเชิญ" readOnly value={link} onFocus={event => event.target.select()} className="mt-2 w-full min-w-0 rounded-xl border border-blue-200 bg-white px-3 py-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
   <button type="button" className={button} onClick={() => { if (!navigator.clipboard) { setCopyError(true); return; } void navigator.clipboard.writeText(link).then(() => { setCopied(true); setCopyError(false); }).catch(() => setCopyError(true)); }}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์เชิญ"}</button>
   {copyError && <p role="status" className="text-sm">กรุณาแตะช่องลิงก์ค้างไว้แล้วคัดลอกด้วยตนเอง</p>}
   <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">ใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง · หมดอายุ {new Date(expiresAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}<br />ลิงก์และ QR แสดงเฉพาะครั้งที่สร้าง หากทำหาย ให้ยกเลิกคำเชิญเดิมแล้วสร้างใหม่</p>

  </div>
  <div className="flex flex-col items-center justify-start gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><QrCode size={18} />สแกนเพื่อรับคำเชิญ</p>{qr ? <><img src={qr} alt="QR สำหรับเปิดคำเชิญเข้าร่วมโรงเรียน" width={240} height={240} className="w-full max-w-60 rounded-xl border border-slate-200 bg-white" /><a href={qr} download="ThaiTeacher-school-invitation.png" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"><Download size={16} />บันทึก QR</a></> : <p className="grid size-60 place-items-center rounded-xl bg-white p-4 text-center text-sm text-slate-500">{qrError ? "สร้าง QR ไม่สำเร็จ ใช้ลิงก์เชิญแทนได้" : "กำลังสร้าง QR…"}</p>}</div>
 </section>;
}
