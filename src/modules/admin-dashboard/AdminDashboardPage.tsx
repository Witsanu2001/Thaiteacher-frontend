import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  ArrowUpRight,
  Clock3,
  CreditCard,
  Database,
  Gauge,
  Search,
} from "lucide-react";
import {
  getAdminAnalytics,
  listUsers,
  type AdminAnalytics,
  type UserProfile,
} from "../../config/services/users.service";
import AdminHeader from "../../shared/components/AdminHeader";

type Period = "day" | "week" | "month";
const periods: { value: Period; label: string; detail: string }[] = [
  { value: "day", label: "วัน", detail: "วันนี้" },
  { value: "week", label: "สัปดาห์", detail: "7 วันล่าสุด" },
  { value: "month", label: "เดือน", detail: "30 วันล่าสุด" },
];
const number = (value: number) => new Intl.NumberFormat("th-TH").format(value);
const dateText = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
const thaiDateKey = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function QuotaCard({
  title,
  metric,
  color,
}: {
  title: string;
  metric: { used: number; freeDailyLimit: number; percent: number };
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {title}
        </p>
        <Gauge size={18} className="text-slate-400" />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">
        {number(metric.used)}{" "}
        <span className="text-sm font-medium text-slate-400">
          / {number(metric.freeDailyLimit)}
        </span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, metric.percent))}%` }}
        />
      </div>
      <p
        className={`mt-2 text-xs ${metric.percent >= 80 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-slate-500"}`}
      >
        {metric.percent.toFixed(1)}% ของสิทธิฟรีรายวัน
        {metric.percent >= 80 ? " · ใกล้ถึงเกณฑ์" : ""}
      </p>
    </div>
  );
}

export default function AdminDashboardPage({
  user,
  onMenu,
  dark,
  onToggleDark,
}: {
  user: User;
  onMenu: () => void;
  onManage: () => void;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("day");
  const [search, setSearch] = useState("");
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([listUsers(user), getAdminAnalytics(user)]).then(
      ([usersResult, analyticsResult]) => {
        if (!mounted) return;
        if (usersResult.status === "fulfilled") setUsers(usersResult.value);
        else setError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ กรุณาตรวจสอบ users-service");
        if (analyticsResult.status === "fulfilled")
          setAnalytics(analyticsResult.value);
        else
          setError("โหลดสถิติการเข้าใช้ไม่สำเร็จ กรุณาตรวจสอบ users-service");
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, [user]);

  const members = useMemo(
    () =>
      users.filter(
        (item) => item.uid !== user.uid && item.status !== "cleared",
      ),
    [users, user.uid],
  );
  const frequencyById = useMemo(
    () =>
      Object.fromEntries(
        (analytics?.frequentUsers ?? []).map((item) => [item.uid, item]),
      ),
    [analytics],
  );
  const trialToday = members.filter(
    (item) =>
      item.plan === "trial" &&
      item.createdAt &&
      thaiDateKey(item.createdAt) === thaiDateKey(new Date()),
  ).length;
  const paid = members.filter((item) => item.plan === "paid").length;
  const selectedPeriod = periods.find((item) => item.value === period)!;
  const rows = useMemo(
    () =>
      members
        .filter((item) =>
          `${item.displayName} ${item.email} ${item.schoolName}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
        )
        .sort(
          (a, b) =>
            (frequencyById[b.uid]?.[period] ?? 0) -
              (frequencyById[a.uid]?.[period] ?? 0) ||
            a.displayName.localeCompare(b.displayName, "th"),
        ),
    [members, frequencyById, period, search],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/40 text-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/20 dark:text-slate-100">
      <AdminHeader
        title="Dashboard ผู้ดูแลระบบ"
        onMenu={onMenu}
        dark={dark}
        onToggleDark={onToggleDark}
      />
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
            ThaiTeacher · ภาพรวมระบบ
          </p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
            การใช้งานของลูกค้า
          </h2>
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 p-5 shadow-sm dark:border-sky-900 dark:from-slate-900 dark:to-sky-950/40">
            <span className="grid size-11 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
              <Clock3 size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
              เริ่มทดลองใช้วันนี้
            </p>
            <strong className="mt-1 block text-4xl tabular-nums">
              {loading ? "…" : number(trialToday)}
            </strong>
            <p className="mt-2 text-xs text-slate-500">
              บัญชีที่สมัครแพ็กเกจทดลองวันนี้ · เวลาไทย
            </p>
          </section>
          <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm dark:border-blue-900 dark:from-slate-900 dark:to-blue-950/40">
            <span className="grid size-11 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              <CreditCard size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
              บัญชีชำระเงินแล้ว
            </p>
            <strong className="mt-1 block text-4xl tabular-nums">
              {loading ? "…" : number(paid)}
            </strong>
            <p className="mt-2 text-xs text-slate-500">
              แพ็กเกจแบบชำระเงินที่ยังมีบัญชีใช้งาน
            </p>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold">ความถี่การเข้าใช้รายคน</h3>
              <p className="mt-1 text-xs text-slate-500">
                นับจำนวนรอบที่เปิดระบบ · {selectedPeriod.detail}
              </p>
            </div>
            <div
              role="group"
              aria-label="ช่วงเวลาการเข้าใช้"
              className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            >
              {periods.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  aria-pressed={period === item.value}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${period === item.value ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-200" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 pt-4">
            <label className="flex max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800">
              <Search size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาชื่อ อีเมล หรือโรงเรียน"
                aria-label="ค้นหาผู้ใช้"
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
          <div className="divide-y divide-slate-100 px-5 pb-3 pt-2 dark:divide-slate-800">
            {rows.length ? (
              rows.map((item) => {
                const frequency = frequencyById[item.uid];
                const count = frequency?.[period] ?? 0;
                return (
                  <div
                    key={item.uid}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {item.displayName?.trim().charAt(0) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.displayName || item.email || "ผู้ใช้"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.schoolName || "ไม่ระบุโรงเรียน"} ·{" "}
                        {item.plan === "trial"
                          ? "ทดลองใช้"
                          : item.plan === "paid"
                            ? "ชำระเงิน"
                            : item.plan === "lifetime"
                              ? "ฟรีตลอดชีพ"
                              : "ไม่มีแพ็กเกจ"}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="text-lg tabular-nums text-blue-700 dark:text-blue-300">
                        {analytics ? number(count) : "—"}{" "}
                        <span className="text-xs font-medium">ครั้ง</span>
                      </strong>
                      <p className="text-[11px] text-slate-400">
                        {frequency?.lastVisit
                          ? `ล่าสุด ${dateText(frequency.lastVisit)}`
                          : "ยังไม่มีข้อมูลการเข้าใช้"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                ไม่พบผู้ใช้
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Database size={20} className="text-blue-600" />
                <h3 className="text-lg font-bold">Firestore · อ่าน เขียน ลบ</h3>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                ตัวเลขจาก Google Cloud Monitoring อาจช้าประมาณ 4 นาที ·
                รอบสิทธิฟรีรีเซ็ตตามเวลาแปซิฟิก
              </p>
            </div>
            <a
              href="https://console.firebase.google.com/project/thaiteacher-app/firestore/usage"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
            >
              เปิด Firebase Usage <ArrowUpRight size={15} />
            </a>
          </div>
          {analytics?.firestore.available ? (
            <>
              <p className="text-xs text-slate-500">
                รอบปัจจุบันตั้งแต่{" "}
                {new Intl.DateTimeFormat("th-TH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Los_Angeles",
                }).format(new Date(analytics.firestore.periodStart))}{" "}
                ตามเวลาแปซิฟิก
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <QuotaCard
                  title="อ่านข้อมูล"
                  metric={analytics.firestore.reads}
                  color="bg-blue-500"
                />
                <QuotaCard
                  title="เขียนข้อมูล"
                  metric={analytics.firestore.writes}
                  color="bg-cyan-500"
                />
                <QuotaCard
                  title="ลบข้อมูล"
                  metric={analytics.firestore.deletes}
                  color="bg-violet-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                ตัวเลขนี้เป็นประมาณการจาก Monitoring
                อาจต่ำกว่ายอดที่เรียกเก็บจริง · เปอร์เซ็นต์เทียบสิทธิฟรีของ
                Firestore Standard และไม่ใช่ขีดจำกัดเมื่อเปิดการเรียกเก็บเงิน
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {loading
                ? "กำลังอ่านข้อมูล Firestore…"
                : "ยังอ่านตัวเลขจาก Cloud Monitoring ไม่ได้ ตรวจว่าเปิด Cloud Monitoring API และบัญชีบริการมีสิทธิ์ Monitoring Viewer"}
            </div>
          )}
        </section>
        <p className="text-xs text-slate-400">
          สถิติการเข้าใช้งานเริ่มนับจากวันที่เปิดระบบติดตามนี้
          ไม่มีข้อมูลย้อนหลังจากก่อนหน้า
        </p>
      </main>
    </div>
  );
}
