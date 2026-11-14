import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { loadLoanContracts } from "../../config/services/loan-contracts.service";
import { loadCashbookEntries } from "../../config/services/cashbook.service";
import { loanLedgerEntries } from "../loan-contracts/loanLedger";
import type { LoanContract } from "../loan-contracts/loanContract";
import { scopedStorage } from "../../shared/funtion/scopedStorage";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import { thaiDate } from "../../shared/funtion/thaiDate";
import {
  currentFiscalYear,
  fiscalYearOf,
} from "../../shared/funtion/fiscalYear";

import type {
  BalanceRow as ReportRow,
  DailyReport as Report,
  CashbookEntry as Entry,
} from "../../shared/funtion/types";
import { money } from "../../shared/funtion/money";
import AnimatedNumber from "../../shared/components/AnimatedNumber";
import { readJson } from "../../shared/funtion/storage";

export default function MoneyRegisterPage({
  school,
  reports,
  fiscalYear,
  onNavigate,
  user,
  viewAsUid,
  demo = false,
}: {
  school: string;
  reports: Report[];
  fiscalYear: number;
  onNavigate: (category: string) => void;
  user?: User;
  viewAsUid?: string;
  demo?: boolean;
}) {
  const ordered = useMemo(
    () => [...reports].sort((a, b) => a.date.localeCompare(b.date)),
    [reports],
  );
  const latest = ordered.at(-1);
  const [selectedDate, setSelectedDate] = useState(latest?.date || "");
  const [selected, setSelected] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const showRegister = (name: string) => {
    setSelected(name);
    requestAnimationFrame(() =>
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() =>
    readJson<Entry[]>(`school-cashbook:${school}`, []),
  );
  useEffect(() => {
    if (demo || !user) return;
    let active = true;
    void loadCashbookEntries(user, viewAsUid).then((remote) => {
      if (!active) return;
      const local = readJson<Entry[]>(`school-cashbook:${school}`, []);
      const linked = readJson<string[]>(`school-cashbook:${school}:linked-ids`, []);
      const remoteIds = new Set(remote.map((entry) => entry.id));
      const legacy = local.filter((entry) => !remoteIds.has(entry.id) && !linked.includes(entry.id));
      const localById = new Map(local.map((entry) => [entry.id, entry]));
      setEntries([...legacy, ...remote.map((entry) => ({ ...entry, attachment: localById.get(entry.id)?.attachment }))]);
    }).catch(() => {});
    return () => { active = false; };
  }, [school, user, viewAsUid, demo]);
  const [loanEntries, setLoanEntries] = useState<Entry[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const contracts: LoanContract[] = demo ? JSON.parse(scopedStorage.getItem(`school-loan-contracts:${school}`) || "[]") : user ? await loadLoanContracts(user, viewAsUid) : [];
        if (active) setLoanEntries(loanLedgerEntries(contracts));
      } catch { if (active) setLoanEntries([]); }
    };
    void refresh();
    window.addEventListener("loan-contracts-changed", refresh);
    return () => { active = false; window.removeEventListener("loan-contracts-changed", refresh); };
  }, [school, user, viewAsUid, demo]);
  const [opening] = useState<Record<string, number>>(() =>
    readJson<Record<string, number>>(`school-cashbook:${school}:opening`, {}),
  );
  const effectiveDate = ordered.some((day) => day.date === selectedDate)
    ? selectedDate
    : latest?.date || "";
  const report = ordered.find((day) => day.date === effectiveDate);
  const names = [
    ...new Set(
      ordered.flatMap((day) =>
        day.rows.filter((row) => !row.group).map((row) => row.name),
      ),
    ),
  ];
  const categories = names.filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );
  const active = selected && names.includes(selected) ? selected : "";
  useEffect(() => {
    const showDetail = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; target?: string }>).detail;
      if (detail?.path !== "/finance/money-register" || detail.target !== "register-detail") return;
      const first = ordered.flatMap((day) => day.rows).find((row) => !row.group)?.name;
      if (first) setSelected(first);
    };
    window.addEventListener("thaiteacher:tour-step", showDetail);
    return () => window.removeEventListener("thaiteacher:tour-step", showDetail);
  }, [ordered]);
  const current = report?.rows.find((row) => row.name === active && !row.group);
  const amount = (row?: ReportRow) =>
    row ? row.cash + row.bank + row.government : 0;
  const categoryEntries = [...entries, ...loanEntries]
    .filter(
      (entry) =>
        entry.category === active && fiscalYearOf(entry.date) === fiscalYear &&
        (!report || entry.date <= report.date),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const openingKey = `${fiscalYear}:${active}`;
  const openingAmount =
    opening[openingKey] ??
    (fiscalYear === currentFiscalYear() ? opening[active] : undefined);
  const hasOpening = openingAmount !== undefined;
  const register = categoryEntries.reduce<Array<Entry & { balance: number }>>(
    (items, entry) => {
      const prior = items.length
        ? items[items.length - 1].balance
        : openingAmount || 0;
      items.push({
        ...entry,
        balance:
          prior + (entry.kind === "income" ? entry.amount : -entry.amount),
      });
      return items;
    },
    [],
  );
  const total = names.reduce(
    (sum, name) =>
      sum + amount(report?.rows.find((row) => row.name === name && !row.group)),
    0,
  );
  return (
    <div className="space-y-5">
      {!report ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          ยังไม่มีรายงานเงินคงเหลือประจำวันสำหรับสร้างทะเบียนคุมเงิน
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm dark:border-blue-900 dark:from-blue-950/50 dark:to-slate-900">
              <p className="text-sm text-slate-500">ประเภทเงินที่ติดตาม</p>
              <p className="mt-2 text-3xl font-bold text-blue-700 dark:text-blue-300">
                <AnimatedNumber value={names.length} />{" "}
                <span className="text-base font-medium">ประเภท</span>
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">ยอดคงเหลือรวม ณ {thaiDate(report.date)}</p>
              <p className="mt-2 break-all text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                ฿ <AnimatedNumber value={total} format={money} />
              </p>
            </article>
          </div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
              <div data-tour="register-summary">
                <h3 className="text-lg font-semibold">ยอดคงเหลือแยกประเภทเงิน</h3>
                <p className="mt-1 text-xs text-slate-500">
                  เลือกประเภทเงินเพื่อเปิดทะเบียน · ยอดและรายการอ้างอิงถึงวันที่เลือก
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                <label data-tour="register-date" className="grid gap-1 text-xs font-medium text-slate-500">
                  ยอด ณ วันที่
                  <select
                    value={effectiveDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {ordered.map((day) => (
                      <option key={day.date} value={day.date}>
                        {thaiDate(day.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label data-tour="register-search" className="relative w-full sm:w-56">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาประเภทเงิน"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </label>
              </div>
            </div>
            {categories.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500 sm:hidden">
                ไม่พบประเภทเงิน
              </p>
            )}
            <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
              {categories.map((name) => {
                const row = report.rows.find(
                  (item) => item.name === name && !item.group,
                );
                return (
                  <button
                    key={name}
                    onClick={() => showRegister(name)}
                    data-tour={name === categories[0] ? "register-open" : undefined}
                    className={`flex w-full items-center justify-between gap-3 p-4 text-left ${name === active ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                  >
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">{name}</strong>
                      <span className="mt-1 block text-xs text-slate-500">
                        เงินสด {money(row?.cash || 0)} · ธนาคาร{" "}
                        {money(row?.bank || 0)} · ส่วนราชการ {money(row?.government || 0)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <strong className="block text-sm tabular-nums text-blue-700 dark:text-blue-300">
                        ฿ {money(amount(row))}
                      </strong>
                      <ArrowRight
                        size={15}
                        className="ml-auto mt-1 text-blue-500"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-blue-50/70 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    {[
                      "ประเภทเงิน",
                      "เงินสด",
                      "เงินฝากธนาคาร",
                      "เงินฝากส่วนราชการผู้เบิก",
                      "คงเหลือ",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-right font-semibold first:text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categories.map((name) => {
                    const row = report.rows.find(
                      (item) => item.name === name && !item.group,
                    );
                    return (
                      <tr
                        key={name}
                        className={
                          name === active
                            ? "bg-blue-50/70 dark:bg-blue-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }
                      >
                        <th
                          scope="row"
                          className="px-4 py-3 text-left font-medium"
                        >
                          <button
                            onClick={() => showRegister(name)}
                            className="text-left hover:text-blue-700"
                          >
                            {name}
                          </button>
                        </th>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {money(row?.cash || 0)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {money(row?.bank || 0)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {money(row?.government || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-700 dark:text-blue-300">
                          {money(amount(row))}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => showRegister(name)}
                            data-tour={name === categories[0] ? "register-open" : undefined}
                            aria-label={`ดูทะเบียน ${name}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:text-blue-300"
                          >
                            <span>ดูทะเบียน</span>
                            <ArrowRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {categories.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  ไม่พบประเภทเงิน
                </p>
              )}
            </div>
          </section>
          {!active && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-5 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <BookOpen size={20} className="shrink-0" />
              เลือกประเภทเงินจากตารางด้านบน เพื่อดูรายการรับ–จ่ายและยอดคงเหลือในทะเบียน
            </div>
          )}
          {active && (
            <section
              ref={detailRef}
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
                <div data-tour="register-detail">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    ทะเบียนรายการ
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{active}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    ยอดตามรายงาน {thaiDate(report.date)}: ฿{" "}
                    {money(amount(current))}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate(active)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  บันทึกรับ–จ่าย <ArrowRight size={16} />
                </button>
              </div>
              <div className="grid gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">ยอดยกมาในทะเบียน</p>
                  <p className="mt-1 font-bold tabular-nums">
                    {hasOpening
                      ? `฿ ${money(openingAmount || 0)}`
                      : "ยังไม่ได้ตั้งยอด"}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <p className="text-xs text-emerald-700">รับ</p>
                  <p className="mt-1 font-bold tabular-nums text-emerald-700">
                    ฿{" "}
                    {money(
                      categoryEntries
                        .filter((e) => e.kind === "income")
                        .reduce((sum, e) => sum + e.amount, 0),
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                  <p className="text-xs text-rose-700">จ่าย</p>
                  <p className="mt-1 font-bold tabular-nums text-rose-700">
                    ฿{" "}
                    {money(
                      categoryEntries
                        .filter((e) => e.kind === "expense")
                        .reduce((sum, e) => sum + e.amount, 0),
                    )}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      {[
                        "วันที่",
                        "เลขที่เอกสาร",
                        "รายการ",
                        "รับ",
                        "จ่าย",
                        "คงเหลือในทะเบียน",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-right font-semibold first:text-left [&:nth-child(2)]:text-left [&:nth-child(3)]:text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {register.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap px-4 py-3">
                          {thaiDate(entry.date)}
                        </td>
                        <td className="px-4 py-3">{entry.documentNo || "–"}</td>
                        <td className="px-4 py-3 font-medium">
                          {entry.description}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {entry.kind === "income" ? money(entry.amount) : "–"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                          {entry.kind === "expense" ? money(entry.amount) : "–"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {hasOpening ? money(entry.balance) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {register.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    ยังไม่มีรายการรับ–จ่ายสำหรับประเภทนี้
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
