import { useEffect, useState } from "react";
import { Cookie, FileText, ShieldCheck, X } from "lucide-react";
import {
  privacySections,
  termsIntroduction,
  termsSections,
} from "../legalContent";

type Panel = "terms" | "privacy" | "cookies";
const storageKey = "thaiteacher-cookie-notice-v1";

const section = (title: string, body: string) => (
  <section className="space-y-1">
    <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
      {body}
    </p>
  </section>
);

export default function LegalCenter() {
  const [acknowledged, setAcknowledged] = useState(
    () => localStorage.getItem(storageKey) === "1",
  );
  const [panel, setPanel] = useState<Panel | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const target = (event as CustomEvent<Panel>).detail;
      setPanel(target === "terms" || target === "privacy" ? target : "cookies");
    };
    window.addEventListener("thaiteacher:open-legal", open);
    return () => window.removeEventListener("thaiteacher:open-legal", open);
  }, []);
  const acknowledge = () => {
    localStorage.setItem(storageKey, "1");
    setAcknowledged(true);
    setPanel(null);
  };
  const title =
    panel === "terms"
      ? "ข้อตกลงการให้บริการ"
      : panel === "privacy"
        ? "ประกาศความเป็นส่วนตัว"
        : "การตั้งค่าคุกกี้";

  return (
    <>
      {!acknowledged && (
        <aside
          aria-label="ข้อมูลการใช้คุกกี้"
          className="fixed bottom-3 left-3 right-3 z-[110] mx-auto max-w-3xl rounded-2xl border border-blue-200 bg-white p-4 text-slate-800 shadow-2xl dark:border-blue-800 dark:bg-slate-900 dark:text-slate-100 sm:bottom-5 sm:p-5 print:hidden"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">
              <Cookie size={20} />
            </span>
            <div>
              <h2 className="font-bold">การใช้งานข้อมูลบนเว็บ</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                ThaiTeacher
                เก็บข้อมูลที่จำเป็นสำหรับการเข้าสู่ระบบและจดจำการตั้งค่าบนเครื่องของคุณ
                ขณะนี้ไม่มีคุกกี้โฆษณาหรือวิเคราะห์ผู้ชม
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={acknowledge}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              รับทราบ
            </button>
            <button
              type="button"
              onClick={() => setPanel("cookies")}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold dark:border-slate-700"
            >
              ดูการตั้งค่า
            </button>
            <button
              type="button"
              onClick={() => setPanel("terms")}
              className="px-2 py-2 text-sm text-blue-700 underline dark:text-blue-300"
            >
              ข้อตกลง
            </button>
            <button
              type="button"
              onClick={() => setPanel("privacy")}
              className="px-2 py-2 text-sm text-blue-700 underline dark:text-blue-300"
            >
              ความเป็นส่วนตัว
            </button>
          </div>
        </aside>
      )}
      {panel && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-3 backdrop-blur-sm print:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPanel(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-panel-title"
            className="flex max-h-[min(90dvh,850px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                {panel === "terms" ? (
                  <FileText size={20} />
                ) : panel === "privacy" ? (
                  <ShieldCheck size={20} />
                ) : (
                  <Cookie size={20} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="legal-panel-title" className="text-lg font-bold">
                  {title}
                </h2>
                <p className="text-xs text-slate-500">
                  ThaiTeacher · ปรับปรุง 13 พฤศจิกายน 2569
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="ปิด"
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
              {(["terms", "privacy", "cookies"] as const).map(
                (value, index) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPanel(value)}
                    className={`rounded-lg px-3 py-2 text-sm ${panel === value ? "bg-blue-600 font-semibold text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                  >
                    {["ข้อตกลง", "ความเป็นส่วนตัว", "คุกกี้"][index]}
                  </button>
                ),
              )}
            </div>
            <div className="space-y-6 overflow-y-auto p-5 sm:p-6">
              {panel === "terms" && (
                <>
                  <p className="text-sm leading-7">{termsIntroduction}</p>
                  {termsSections.map(({ title, body }) => (
                    <div key={title}>{section(title, body)}</div>
                  ))}
                </>
              )}
              {panel === "privacy" && (
                <>
                  {privacySections.map(({ title, body }) => (
                    <div key={title}>{section(title, body)}</div>
                  ))}
                </>
              )}
              {panel === "cookies" && (
                <>
                  <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                    เว็บนี้ใช้พื้นที่เก็บข้อมูลของเบราว์เซอร์และข้อมูลที่
                    Firebase ต้องใช้ในการเข้าสู่ระบบ
                    การตั้งค่าด้านล่างแสดงสิ่งที่ใช้งานจริงในขณะนี้
                  </p>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <strong>ข้อมูลที่จำเป็น</strong>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        เปิดอยู่
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      การเข้าสู่ระบบ ความปลอดภัย ธีมหน้าจอ ข้อมูลตัวอย่าง
                      และการตั้งค่าที่คุณเลือก บางรายการเก็บในเครื่องด้วย
                      localStorage หรือพื้นที่เก็บข้อมูลของ Firebase
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <strong>โฆษณาและวิเคราะห์ผู้ชม</strong>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                        ไม่ได้ใช้งาน
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      ขณะนี้ไม่มีเครื่องมือประเภทนี้ให้เปิดหรือปิด
                      หากเพิ่มในอนาคต จะขอให้คุณเลือกก่อนใช้งาน
                    </p>
                  </div>
                  <p className="text-xs leading-6 text-slate-500">
                    การกด “รับทราบ” เป็นการปิดแถบแจ้งข้อมูล
                    ไม่ใช่การยินยอมให้ใช้เครื่องมือโฆษณาหรือวิเคราะห์ผู้ชม
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
              >
                ปิด
              </button>
              {!acknowledged && (
                <button
                  type="button"
                  onClick={acknowledge}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  รับทราบ
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
