import { Plus, Trash2 } from "lucide-react";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import { emptyRepayment, loanOutstanding, type LoanContract, type LoanRepayment } from "./loanContract";

const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const label = "grid min-w-0 gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";
const money = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LoanRepayments({ contract, onChange, savedCount, availableDates }: {
  contract: LoanContract;
  onChange: (repayments: LoanRepayment[]) => void;
  savedCount: number;
  availableDates: string[];
}) {
  const repayments = contract.repayments || [];
  const patch = (id: string, name: keyof LoanRepayment, value: string) => onChange(repayments.map((item) => item.id === id ? { ...item, [name]: value } : item));
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-semibold">รายการส่งใช้เงินยืม</h3><p className="mt-1 text-sm text-slate-500">เมื่อบันทึก จะเพิ่มเป็นรายรับในทะเบียนและรายงานเงินคงเหลือของวันที่ส่งใช้</p></div>
      <button type="button" disabled={repayments.length >= 19} onClick={() => onChange([...repayments, emptyRepayment()])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300"><Plus size={16}/> เพิ่มรายการ</button>
    </div>
    {repayments.length ? <div className="space-y-3">{repayments.map((item, index) => <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-sm">รายการที่ {index + 1}{index < savedCount ? " · บันทึกแล้ว" : ""}</strong>{index >= savedCount && <button type="button" aria-label={`ลบรายการส่งใช้ที่ ${index + 1}`} onClick={() => onChange(repayments.filter((row) => row.id !== item.id))} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"><Trash2 size={17}/></button>}</div>
      <fieldset disabled={index < savedCount} className="disabled:opacity-65">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={label}><span>วันที่ส่งใช้</span><ThaiDatePicker value={item.date} availableDates={availableDates} onChange={(value) => patch(item.id, "date", value)}/></div>
        <label className={label}>รายการส่งใช้<input className={field} value={item.description} onChange={(event) => patch(item.id, "description", event.target.value)} placeholder="เงินสดหรือเลขที่ใบสำคัญ"/></label>
        <label className={label}>จำนวนเงิน<input type="number" min="0" step="0.01" className={field} value={item.amount} onChange={(event) => patch(item.id, "amount", event.target.value)} placeholder="0.00"/></label>
        <label className={label}>ใบรับเลขที่<input className={field} value={item.receiptNo} onChange={(event) => patch(item.id, "receiptNo", event.target.value)} placeholder="ระบุเลขที่ใบรับ"/></label>
      </div>
      </fieldset>
    </div>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">ยังไม่มีรายการส่งใช้ กด “เพิ่มรายการ” เพื่อบันทึกครั้งแรก</p>}
    <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950"><span>ยอดคงค้าง</span><strong className="text-lg text-blue-800 dark:text-blue-200">{money(loanOutstanding(contract))} บาท</strong></div>
  </section>;
}
