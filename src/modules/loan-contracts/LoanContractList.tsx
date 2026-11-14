import { FileCheck2, FileText, Plus, Search } from "lucide-react";
import { useState } from "react";
import { thaiDate } from "../../shared/funtion/thaiDate";
import { loanTotal, type LoanContract } from "./loanContract";

const money = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LoanContractList({ school, contracts, onCreate, onOpen, message }: {
  school: string;
  contracts: LoanContract[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  message?: string;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("th-TH");
  const filtered = [...contracts]
    .sort((a, b) => (b.loanDate || b.updatedAt).localeCompare(a.loanDate || a.updatedAt))
    .filter((item) => !query || [item.number, item.borrower, item.borrowFrom, item.purpose].some((value) => value?.toLocaleLowerCase("th-TH").includes(query)));

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FileCheck2 size={24}/></span><div><h2 className="text-xl font-semibold sm:text-2xl">สัญญาการยืมเงิน</h2><p className="mt-1 text-sm text-slate-500">{school} · {contracts.length} สัญญา</p></div></div>
      <button type="button" data-tour="loan-create" onClick={onCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"><Plus size={18}/> เพิ่มสัญญายืมเงิน</button>
    </header>
    {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">{message}</p>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5"><div><h3 className="font-semibold">รายการสัญญาที่บันทึก</h3><p className="text-sm text-slate-500">เลือกสัญญาเพื่อดูรายละเอียดหรือแก้ไข</p></div><label className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-slate-300 px-3 text-slate-500 dark:border-slate-700 sm:w-72"><Search size={18}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาเลขที่ ผู้ยืม หรือวัตถุประสงค์" className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white"/></label></div>
      {filtered.length ? <>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
          {filtered.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="block w-full p-4 text-left hover:bg-blue-50 dark:hover:bg-slate-800"><span className="flex items-start justify-between gap-2"><span className="font-semibold text-slate-900 dark:text-white">{item.borrower || "ยังไม่ระบุผู้ยืม"}</span><span className="text-xs text-blue-700 dark:text-blue-300">ดูสัญญา</span></span><span className="mt-1 block text-sm text-slate-500">เลขที่ {item.number || "ยังไม่มีเลขที่"} · {thaiDate(item.loanDate)}</span><span className="mt-2 block text-xs font-semibold text-blue-700 dark:text-blue-300">{item.approvedAt ? "อนุมัติแล้ว" : "รออนุมัติ"}</span><span className="mt-3 block text-xs font-semibold text-slate-500">เพื่อเป็นค่าใช้จ่ายในการ</span><span className="mt-1 block break-words text-sm text-slate-800 dark:text-slate-200">{item.purpose?.trim() || "ยังไม่ระบุ"}</span><span className="mt-3 block text-sm text-slate-600 dark:text-slate-300">{item.borrowFrom || "ยังไม่ระบุแหล่งเงิน"}</span><span className="mt-2 block font-semibold tabular-nums">ยอดยืม {money(loanTotal(item))} บาท</span></button>)}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-5 py-3 font-semibold">เลขที่ / วันที่</th><th className="px-5 py-3 font-semibold">ผู้ยืม</th><th className="px-5 py-3 font-semibold">เพื่อเป็นค่าใช้จ่ายในการ</th><th className="px-5 py-3 font-semibold">แหล่งเงิน</th><th className="px-5 py-3 text-right font-semibold">ยอดยืม</th><th className="px-5 py-3 font-semibold">สถานะ</th><th className="px-5 py-3 text-right font-semibold">จัดการ</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filtered.map((item) => <tr key={item.id} className="hover:bg-blue-50/60 dark:hover:bg-slate-800/70"><td className="px-5 py-4"><strong className="block text-slate-900 dark:text-white">{item.number || "ยังไม่มีเลขที่"}</strong><span className="text-xs text-slate-500">{thaiDate(item.loanDate)}</span></td><td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{item.borrower || "ยังไม่ระบุ"}</td><td className="max-w-[22rem] break-words px-5 py-4 text-slate-700 dark:text-slate-300" title={item.purpose}>{item.purpose?.trim() || "ยังไม่ระบุ"}</td><td className="max-w-48 truncate px-5 py-4" title={item.borrowFrom}>{item.borrowFrom || "—"}</td><td className="px-5 py-4 text-right tabular-nums">{money(loanTotal(item))}</td><td className="px-5 py-4 text-xs font-semibold text-blue-700 dark:text-blue-300">{item.approvedAt ? "อนุมัติแล้ว" : "รออนุมัติ"}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => onOpen(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950"><FileText size={15}/> ดู / แก้ไข</button></td></tr>)}</tbody></table></div>
      </> : <div className="grid justify-items-center gap-3 px-5 py-14 text-center text-slate-500"><FileText size={32} className="text-blue-400"/><p>{contracts.length ? "ไม่พบสัญญาที่ค้นหา" : "ยังไม่มีสัญญาการยืมเงิน"}</p>{!contracts.length && <button type="button" onClick={onCreate} className="rounded-xl bg-blue-700 px-4 py-2.5 font-semibold text-white">เพิ่มสัญญาฉบับแรก</button>}</div>}
    </section>
  </div>;
}
