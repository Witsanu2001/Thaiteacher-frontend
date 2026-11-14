import type { DailyReport } from "../../shared/funtion/types";
import ThaiDatePicker from "../../shared/components/ThaiDatePicker";
import { loanTotal, type LoanContract } from "./loanContract";

type SourceAccount = NonNullable<LoanContract["sourceAccount"]>;
const channels: { key: SourceAccount; label: string }[] = [
  { key: "cash", label: "เงินสด" },
  { key: "bank", label: "เงินฝากธนาคาร" },
  { key: "government", label: "เงินฝากส่วนราชการผู้เบิก" },
];
const money = (value: number) => value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function LoanSourcePicker({ contract, reports, onChange }: {
  contract: LoanContract;
  reports: DailyReport[];
  onChange: (change: Partial<LoanContract>) => void;
}) {
  const available = reports.filter((report) => report.date <= contract.loanDate).sort((a, b) => b.date.localeCompare(a.date));
  const reportDate = available.some((item) => item.date === contract.sourceReportDate)
    ? contract.sourceReportDate || "" : available[0]?.date || "";
  const report = available.find((item) => item.date === reportDate);
  const rows = report?.rows.map((row, index) => ({ row, index })).filter(({ row }) => !row.group) || [];
  const selected = rows.find(({ row, index }) => index === contract.sourceRowIndex && row.name === contract.sourceCategory)
    || rows.find(({ row }) => row.name === contract.sourceCategory);
  const balance = selected && contract.sourceAccount ? Number(selected.row[contract.sourceAccount]) || 0 : null;
  const total = loanTotal(contract);

  if (!available.length) return (
    <div data-tour="loan-source" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      ยังไม่มีรายงานเงินคงเหลือก่อนหรือในวันทำสัญญา กรุณาบันทึกรายงานรายวันก่อนเลือกแหล่งเงิน
    </div>
  );

  return <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30 sm:p-5">
    <div><h4 className="font-semibold text-slate-900 dark:text-white">แหล่งเงินที่ยืม</h4><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">อ้างอิงยอดจากรายงานเงินคงเหลือประจำวันของโรงเรียน</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5 text-sm font-medium"><span>วันที่รายงาน</span>
        <ThaiDatePicker value={reportDate} availableDates={available.map((item) => item.date)} onChange={(date) => onChange({ sourceReportDate: date, sourceCategory: "", sourceRowIndex: undefined, sourceAccount: undefined, borrowFrom: "" })} />
      </div>
      <label data-tour="loan-source" className="grid gap-1.5 text-sm font-medium">ประเภทเงิน
        <select className={input} value={selected?.index ?? ""} onChange={(event) => {
          const item = event.target.value === "" ? undefined : rows.find(({ index }) => index === Number(event.target.value));
          onChange({ sourceReportDate: reportDate, sourceCategory: item?.row.name || "", sourceRowIndex: item?.index, sourceAccount: undefined, borrowFrom: "" });
        }}>
          <option value="">เลือกประเภทเงิน</option>
          {rows.map(({ row, index }) => <option key={index} value={index}>{row.name}</option>)}
        </select>
      </label>
    </div>
    {selected && <div className="space-y-2"><p className="text-sm font-medium">ยืมจากช่องทาง</p><div className="grid gap-2 sm:grid-cols-3">
      {channels.map((channel) => <button key={channel.key} type="button" onClick={() => onChange({ sourceReportDate: reportDate, sourceCategory: selected.row.name, sourceRowIndex: selected.index, sourceAccount: channel.key, borrowFrom: `${selected.row.name} (${channel.label})` })}
        className={`rounded-xl border p-3 text-left text-sm transition-colors ${contract.sourceAccount === channel.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"}`}>
        <span className="block font-semibold">{channel.label}</span><span className="mt-1 block tabular-nums">{money(Number(selected.row[channel.key]) || 0)} บาท</span>
      </button>)}
    </div></div>}
    {balance !== null && <div className="rounded-xl bg-white p-3 text-sm dark:bg-slate-900"><span className="text-slate-500 dark:text-slate-400">ยอดคงเหลือที่อ้างอิง</span><strong className="ml-2 tabular-nums text-blue-700 dark:text-blue-300">{money(balance)} บาท</strong>{total > balance && <p className="mt-1 text-amber-700 dark:text-amber-300">ยอดยืม {money(total)} บาท สูงกว่ายอดคงเหลือที่เลือก กรุณาตรวจสอบก่อนจ่ายเงินจริง</p>}</div>}
    <p className="text-xs text-slate-500 dark:text-slate-400">ระบบจะหักยอดในรายงานของวันทำสัญญาเมื่อกด “อนุมัติและหักยอด”</p>
  </div>;
}
