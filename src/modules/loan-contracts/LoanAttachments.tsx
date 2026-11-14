import { FileImage, FileText, Plus, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import type { LoanAttachment } from "./loanContract";

const accept = "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx";
const maxFiles = 12;
const maxBytes = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const allowedExtensions = /\.(jpe?g|png|webp|pdf|docx?|xlsx?)$/i;
const sizeText = (size: number) => `${(size / 1024 / 1024).toFixed(1)} MB`;

function FileItem({ name, size, image, pending, onOpen, onRemove }: {
  name: string; size: number; image: boolean; pending?: boolean; onOpen: () => void; onRemove: () => void;
}) {
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{image ? <FileImage size={20}/> : <FileText size={20}/>}</span>
    <div className="min-w-0 flex-1"><p className="truncate font-medium" title={name}>{name}</p><p className="text-xs text-slate-500">{sizeText(size)}{pending ? " · รอบันทึก" : ""}</p></div>
    <button type="button" onClick={onOpen} className="rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-700">เปิด</button>
    <button type="button" onClick={onRemove} aria-label={`ลบ ${name}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 size={17}/></button>
  </div>;
}

export default function LoanAttachments({ front, back, pendingFront, pendingBack, onFront, onBack, onRemoveFront, onRemoveBack, onOpenSaved, onError }: {
  front?: LoanAttachment;
  back: LoanAttachment[];
  pendingFront: File | null;
  pendingBack: File[];
  onFront: (file: File) => void;
  onBack: (files: File[]) => void;
  onRemoveFront: () => void;
  onRemoveBack: (index: number, pending: boolean) => void;
  onOpenSaved: (attachment: LoanAttachment) => void;
  onError: (message: string) => void;
}) {
  const validate = (files: File[]) => {
    if (files.some(file => !allowedTypes.has(file.type) && !(file.type === "" && allowedExtensions.test(file.name)))) { onError("รองรับรูปภาพ JPG, PNG, WebP และเอกสาร PDF, Word, Excel เท่านั้น"); return false; }
    if (files.some(file => file.size > maxBytes || file.size === 0)) { onError("แต่ละไฟล์ต้องมีขนาดไม่เกิน 10 MB"); return false; }
    return true;
  };
  const chooseFront = (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (file && validate([file])) onFront(file);
    } catch {
      onError("อ่านไฟล์ด้านหน้าไม่สำเร็จ กรุณาลองเลือกไฟล์อีกครั้ง");
    } finally {
      event.currentTarget.value = "";
    }
  };
  const chooseBack = (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(event.currentTarget.files || []);
      if (back.length + pendingBack.length + files.length > maxFiles) { onError(`เอกสารด้านหลังแนบได้สูงสุด ${maxFiles} ไฟล์`); return; }
      if (files.length && validate(files)) onBack(files);
    } catch {
      onError("อ่านไฟล์ด้านหลังไม่สำเร็จ กรุณาลองเลือกไฟล์อีกครั้ง");
    } finally {
      event.currentTarget.value = "";
    }
  };
  const openPending = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div data-tour="loan-attachments"><h3 className="text-lg font-semibold">เอกสารแนบ</h3><p className="mt-1 text-sm text-slate-500">แนบภาพถ่ายหรือเอกสารประกอบสัญญา ไฟล์ละไม่เกิน 10 MB</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div><h4 className="font-semibold">ด้านหน้า</h4><p className="text-sm text-slate-500">แนบได้ 1 ไฟล์</p></div>
        {pendingFront ? <FileItem name={pendingFront.name} size={pendingFront.size} image={pendingFront.type.startsWith("image/")} pending onOpen={() => openPending(pendingFront)} onRemove={onRemoveFront}/>
          : front ? <FileItem name={front.name} size={front.size} image={front.contentType.startsWith("image/")} onOpen={() => onOpenSaved(front)} onRemove={onRemoveFront}/>
          : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">ยังไม่ได้แนบเอกสารด้านหน้า</p>}
        <label className="relative inline-flex min-h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"><Upload size={16}/>{front || pendingFront ? "เปลี่ยนไฟล์" : "เลือกไฟล์ด้านหน้า"}<input type="file" accept={accept} aria-label="เลือกไฟล์ด้านหน้า" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={chooseFront}/></label>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div><h4 className="font-semibold">ด้านหลังและเอกสารเพิ่มเติม</h4><p className="text-sm text-slate-500">แนบได้หลายไฟล์ สูงสุด {maxFiles} ไฟล์</p></div>
        {back.length + pendingBack.length ? <div className="space-y-2">{back.map((file, index) => <FileItem key={file.file} name={file.name} size={file.size} image={file.contentType.startsWith("image/")} onOpen={() => onOpenSaved(file)} onRemove={() => onRemoveBack(index, false)}/>)}{pendingBack.map((file, index) => <FileItem key={`${file.name}-${index}`} name={file.name} size={file.size} image={file.type.startsWith("image/")} pending onOpen={() => openPending(file)} onRemove={() => onRemoveBack(index, true)}/>)}</div>
          : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">ยังไม่ได้แนบเอกสารด้านหลัง</p>}
        <label className="relative inline-flex min-h-10 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"><Plus size={16}/> เพิ่มไฟล์ด้านหลัง<input type="file" multiple accept={accept} aria-label="เพิ่มไฟล์ด้านหลัง" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={chooseBack}/></label>
      </div>
    </div>
  </section>;
}
