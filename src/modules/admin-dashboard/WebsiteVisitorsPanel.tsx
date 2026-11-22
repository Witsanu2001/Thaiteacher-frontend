import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { RefreshCw } from "lucide-react";
import { getVisitorDashboard, type VisitorDashboard } from "../../config/services/users.service";

const labels: Record<string, string> = {
  home: "หน้าแรก", demo: "หน้าทดลองระบบ", invite: "หน้าคำเชิญ", billing: "หน้าชำระเงิน", other: "อื่น ๆ",
  direct: "เข้าโดยตรง / ไม่ทราบ", google: "Google", facebook: "Facebook", line: "LINE", internal: "ลิงก์ภายในเว็บ",
  mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์",
};
const number = (n: number) => n.toLocaleString("th-TH");
const requests = new WeakMap<User, Promise<VisitorDashboard>>();
function load(user: User) {
  let promise = requests.get(user);
  if (!promise) {
    promise = getVisitorDashboard(user);
    requests.set(user, promise);
    void promise.finally(() => { requests.delete(user); }).catch(() => undefined);
  }
  return promise;
}
export default function WebsiteVisitorsPanel({ user }: { user: User }) {
  const [data, setData] = useState<VisitorDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void load(user).then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError("โหลดสถิติผู้เข้าชมไม่สำเร็จ กรุณาตรวจ users-service แล้วลองใหม่"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, revision]);
  const max = Math.max(1, ...data?.daily.map(d => d.visitors) ?? []);
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold">ผู้เข้าชมก่อนล็อกอิน</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">เฉพาะเบราว์เซอร์ที่อนุญาตสถิติและยังไม่เข้าสู่ระบบ · วันตามเวลาไทย</p></div>
      <button type="button" aria-label="รีเฟรชสถิติผู้เข้าชม" disabled={loading}
        onClick={() => { setLoading(true); setError(""); setRevision(n => n + 1); }}
        className="rounded-xl border border-slate-200 p-2.5 disabled:opacity-40 dark:border-slate-700">
        <RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
    </div>
    <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
      รหัสผู้เข้าชมเป็นรหัสสุ่มของเบราว์เซอร์ ไม่ใช่ชื่อบุคคลหรือบัญชี Google การล้างข้อมูลเว็บหรือใช้เครื่องอื่นอาจนับเป็นคนใหม่ สถิตินี้เริ่มเก็บหลังเปิดใช้ฟีเจอร์ และไม่ควรบวกกับยอดผู้ล็อกอินเพื่อหาจำนวนคนจริง
    </p>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {loading && !data ? <p role="status" className="py-6 text-center text-slate-500">กำลังโหลดสถิติ…</p> : data && <>
      {data.truncated && <p className="text-sm text-amber-600">แสดงจาก 10,000 รายการล่าสุด ยอดในช่วงนี้อาจไม่ครบ</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[
        ["ผู้เข้าชมวันนี้", data.today], ["ผู้เข้าชม 7 วัน", data.week], ["ผู้เข้าชม 30 วัน", data.month],
        ["การเข้าชม 30 วัน", data.sessions], ["หน้าที่เปิด 30 วัน", data.views],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-2xl tabular-nums">{number(Number(value))}</strong></div>)}</div>
      <div><h3 className="mb-3 font-semibold">ผู้เข้าชมรายวัน · 30 วันล่าสุด</h3>
        <div className="flex h-36 items-end gap-1" role="img" aria-label="กราฟผู้เข้าชมรายวัน รายละเอียดอ่านได้ในตารางด้านล่าง">
          {data.daily.map(d => <div key={d.date} className="flex h-full min-w-0 flex-1 items-end" title={`${d.date}: ${d.visitors} ผู้เข้าชม`}>
            <div className="w-full rounded-t bg-blue-500" style={{ height: `${d.visitors ? Math.max(3, d.visitors / max * 100) : 0}%` }} />
          </div>)}
        </div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{data.daily[0]?.date}</span><span>{data.daily.at(-1)?.date}</span></div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-blue-600 dark:text-blue-300">ดูตัวเลขรายวัน</summary><div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th>วันที่</th><th>ผู้เข้าชม</th><th>การเข้าชม</th><th>หน้าที่เปิด</th></tr></thead><tbody>{data.daily.map(d => <tr key={d.date}><td className="py-1">{d.date}</td><td>{d.visitors}</td><td>{d.sessions}</td><td>{d.views}</td></tr>)}</tbody></table></div></details>
      </div>
      <div className="grid gap-4 md:grid-cols-3">{[["หน้าที่เปิด", data.pages], ["แหล่งที่มา", data.sources], ["อุปกรณ์", data.devices]].map(([title, values]) => <div key={String(title)} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h3 className="font-semibold">{String(title)}</h3><p className="mt-1 text-xs text-slate-500">นับตามหน้าที่เปิด ไม่รวมรีเฟรชซ้ำในช่วงเดียวกัน</p><ul className="mt-3 space-y-2 text-sm">{(values as VisitorDashboard["pages"]).map(v => <li key={v.name} className="flex justify-between gap-2"><span>{labels[v.name] || "อื่น ๆ"}</span><strong>{number(v.count)}</strong></li>)}</ul>{!(values as VisitorDashboard["pages"]).length && <p className="mt-3 text-sm text-slate-500">ยังไม่มีข้อมูล</p>}</div>)}</div>
      <div><h3 className="mb-3 font-semibold">การเปิดหน้าล่าสุดก่อนล็อกอิน</h3><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-slate-500"><tr>{["ผู้เข้าชม", "หน้าที่เปิด", "อุปกรณ์", "แหล่งที่มา", "เวลา"].map(t => <th key={t} className="pb-3 font-medium">{t}</th>)}</tr></thead><tbody>{data.recent.map((v, i) => <tr key={`${v.code}:${v.at}:${i}`} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 font-mono">#{v.code}</td><td>{labels[v.page]}</td><td>{labels[v.device]}</td><td>{labels[v.source]}</td><td>{new Date(v.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" })}</td></tr>)}</tbody></table>{!data.recent.length && <p className="py-8 text-center text-sm text-slate-500">ยังไม่มีผู้เข้าชมที่บันทึกไว้</p>}</div></div>
    </>}
  </section>;
}
