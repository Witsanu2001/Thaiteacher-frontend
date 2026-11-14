import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, X } from "lucide-react";
import { pageTours } from "./tourContent";

type Box = { top: number; left: number; width: number; height: number };

function visibleTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  const selector = name === "contact-compose" ? '[aria-label="พิมพ์ข้อความ"]' : `[data-tour="${name}"]`;
  return [...document.querySelectorAll<HTMLElement>(selector)].find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  }) ?? null;
}

export default function GuidedTour({ accountKey, dark = false, autoStart = true, mode = "teacher" }: { accountKey: string; dark?: boolean; autoStart?: boolean; aiAllowed?: boolean; mode?: "teacher" | "admin" }) {
  const location = useLocation();
  const page = pageTours[location.pathname];
  const storageKey = `thaiteacher-page-tour-v1:${mode}:${accountKey}:${location.pathname}`;
  const [requested, setRequested] = useState(false);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const start = () => { setIndex(0); setRequested(true); };
    window.addEventListener("thaiteacher:start-tour", start);
    return () => window.removeEventListener("thaiteacher:start-tour", start);
  }, []);

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setOpen(false);
      setRequested(false);
      setIndex(0);
      setBox(null);
    }, 0);
    if (!page) return () => window.clearTimeout(reset);
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(location.search).get("tour") === "1") setRequested(true);
      else if (autoStart) {
        try { if (!localStorage.getItem(storageKey)) setRequested(true); }
        catch { setRequested(true); }
      }
    }, 250);
    return () => { window.clearTimeout(reset); window.clearTimeout(timer); };
  }, [location.pathname, location.search, accountKey, autoStart, mode, storageKey, page]);

  useEffect(() => {
    if (!requested || !page || open) return;
    const launch = () => {
      if (!visibleTarget(page.steps[0]?.target) && !visibleTarget("page-title")) return;
      setOpen(true);
      setRequested(false);
    };
    launch();
    const observer = new MutationObserver(launch);
    observer.observe(document.body, { childList: true, subtree: true });
    const fallback = window.setTimeout(() => { setOpen(true); setRequested(false); }, 5000);
    return () => { observer.disconnect(); window.clearTimeout(fallback); };
  }, [requested, page, open]);

  const current = page?.steps[index];
  useEffect(() => {
    if (!open || !current) return;
    let target = visibleTarget(current.target) ?? visibleTarget("page-title");
    const update = () => {
      if (!target?.isConnected) { setBox(null); return; }
      const rect = target.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    target?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    update();
    const settle = window.setTimeout(update, 400);
    const observer = new MutationObserver(() => {
      if (target?.isConnected && visibleTarget(current.target)) return;
      target = visibleTarget(current.target) ?? visibleTarget("page-title");
      update();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    nextRef.current?.focus();
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [current, open]);

  const finish = () => {
    try { localStorage.setItem(storageKey, new Date().toISOString()); } catch { /* Can replay from the header. */ }
    setOpen(false);
    setRequested(false);
    setBox(null);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open || !page || !current) return null;
  const width = Math.min(current.example ? 480 : 410, window.innerWidth - 24);
  const height = Math.min(current.example ? 470 : 300, window.innerHeight - 24);
  const left = box ? Math.max(12, Math.min(box.left + box.width / 2 - width / 2, window.innerWidth - width - 12)) : (window.innerWidth - width) / 2;
  const top = box && box.top + box.height + height + 14 < window.innerHeight ? box.top + box.height + 14
    : box && box.top - height - 14 > 12 ? box.top - height - 14
      : Math.max(12, (window.innerHeight - height) / 2);

  return createPortal(
    <div className={`fixed inset-0 z-[120] text-slate-900 ${dark ? "dark" : ""}`} role="presentation">
      {!box && <div className="absolute inset-0 bg-slate-950/70" />}
      {box && <div aria-hidden="true" className="pointer-events-none fixed rounded-xl border-2 border-sky-400" style={{ top: Math.max(2, box.top - 5), left: Math.max(2, box.left - 5), width: box.width + 10, height: box.height + 10, boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.72), 0 0 0 4px rgba(56, 189, 248, 0.28)" }} />}
      <section role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-description" className="fixed flex flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white" style={{ top, left, width, maxHeight: "calc(100dvh - 24px)" }}>
        <div className="min-h-0 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300"><BookOpen size={15} />{page.name} · {index + 1}/{page.steps.length}</span><button type="button" onClick={finish} aria-label="ปิดคำแนะนำ" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={19} /></button></div>
          <div className="mt-3 flex gap-1" aria-hidden="true">{page.steps.map((_, stepIndex) => <span key={stepIndex} className={`h-1.5 flex-1 rounded-full ${stepIndex <= index ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"}`} />)}</div>
          <h2 id="tour-title" className="mt-4 text-lg font-bold">{current.title}</h2>
          <p id="tour-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.description}</p>
          {current.example && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-blue-800 dark:bg-blue-950/40"><div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-sm text-blue-900 dark:text-blue-200">{current.example.heading}</strong><span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-300">ข้อมูลจำลอง</span></div><dl className="mt-2 divide-y divide-blue-100 text-sm dark:divide-blue-900">{current.example.rows.map(([label, value], rowIndex) => <div key={`${label}:${rowIndex}`} className="flex justify-between gap-3 py-1.5"><dt className="text-slate-600 dark:text-slate-300">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl>{current.example.result && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-blue-700 dark:bg-slate-800 dark:text-blue-300">{current.example.result}</p>}</div>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">ตัวอย่างนี้ใช้สอนเท่านั้น ไม่มีการบันทึกหรือเปลี่ยนข้อมูลจริง</p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900"><button type="button" onClick={finish} className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white">ข้ามหน้านี้</button><div className="flex gap-2">{index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"><ArrowLeft size={15} /> ย้อนกลับ</button>}<button ref={nextRef} type="button" onClick={() => index === page.steps.length - 1 ? finish() : setIndex(index + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">{index === page.steps.length - 1 ? "เสร็จสิ้น" : "ถัดไป"}{index < page.steps.length - 1 && <ArrowRight size={15} />}</button></div></div>
      </section>
    </div>, document.body,
  );
}
