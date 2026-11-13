import { ArrowDown } from "lucide-react";
import type { ProjectActivity } from "./projectModel";

const money = (amount: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export default function ActivityBalanceCard({ activity, spentForSource }: {
  activity: ProjectActivity;
  spentForSource: (category: string) => number;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
    <h5 className="font-bold">{activity.name}</h5>
    {activity.allocations.length ? <div className="mt-3 space-y-2">
      {activity.allocations.map((allocation) => {
        const spent = spentForSource(allocation.category);
        const remaining = allocation.budget - spent;
        return <div key={allocation.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0"><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{allocation.category || allocation.sourceLabel || "ยังไม่เลือกประเภทเงิน"}</p><p className="mt-1 text-xs text-slate-500">จ่ายแล้ว {money(spent)} บาท</p></div>
          <div className="min-w-36 text-left sm:text-right"><p className="text-xs text-slate-500 dark:text-slate-400">ยอดเดิม {money(allocation.budget)} บาท</p><div className="mt-1 flex items-center gap-1 text-blue-700 dark:text-blue-300 sm:justify-end"><ArrowDown size={14}/><p className="font-bold tabular-nums">คงเหลือ {money(remaining)} บาท</p></div></div>
        </div>;
      })}
    </div> : <p className="mt-2 text-sm text-slate-500">ยังไม่กำหนดแหล่งเงิน</p>}
  </div>;
}
