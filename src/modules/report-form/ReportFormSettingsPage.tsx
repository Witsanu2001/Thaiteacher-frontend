import { useState, type CSSProperties } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, FileSpreadsheet, Italic, Plus, Trash2, Underline, X } from "lucide-react";
import ReportPageCanvas from "../../shared/components/ReportPageCanvas";
import {
  defaultTableHeaders,
  loadReportLayout,
  signatureText,
  newId,
  saveReportLayout,
  type ReportBlock,
  type ReportBlockType,
  type ReportLayout,
} from "../../shared/funtion/reportPageLayout";

type Selection = { page: number; row: number; slot: number };
const choices: { type: ReportBlockType; label: string; hint: string }[] = [
  { type: "text", label: "ข้อความ", hint: "พิมพ์ข้อความได้หลายบรรทัด" },
  { type: "date", label: "วันที่", hint: "กำหนดรูปแบบวัน เดือน ปี" },
  { type: "signature", label: "ลงชื่อ / ตำแหน่ง", hint: "พิมพ์ชื่อและตำแหน่งเอง" },
  { type: "divider", label: "เส้นคั่น", hint: "เพิ่มเส้นแบ่งส่วนเอกสาร" },
  { type: "table", label: "ตารางรายงาน", hint: "ปรับหัวตารางและตัวอักษร" },
];
export default function ReportFormSettingsPage({
  school,
  date,
  onPreview,
}: {
  school: string;
  date: string;
  onPreview?: () => void;
}) {
  const [layout, setLayout] = useState<ReportLayout>(() =>
    loadReportLayout(school),
  );
  const [selected, setSelected] = useState<Selection | null>(null);
  const [menu, setMenu] = useState<{ page: number; row: number } | null>(null);
  const update = (fn: (draft: ReportLayout) => void) => {
    const draft = structuredClone(layout);
    fn(draft);
    setLayout(draft);
    saveReportLayout(school, draft);
  };
  const rowAt = (l: ReportLayout, p: number, r: number) => l.pages[p].rows[r];
  const block = selected
    ? layout.pages[selected.page].rows[selected.row].blocks[selected.slot]
    : null;
  const editorStyle: CSSProperties | undefined = block ? {
    textAlign: block.align || "left",
    fontSize: `${block.fontSize || 12}pt`,
    fontWeight: block.bold === false ? 400 : 600,
    fontStyle: block.italic ? "italic" : "normal",
    textDecoration: block.underline ? "underline" : "none",
  } : undefined;
  const setBlock = (patch: Partial<ReportBlock> | null) => {
    if (!selected) return;
    update((l) => {
      const row = rowAt(l, selected.page, selected.row);
      row.blocks[selected.slot] =
        patch === null
          ? null
          : {
              ...(row.blocks[selected.slot] || { id: newId(), type: "text" }),
              ...patch,
            };
    });
  };
  const changeColumns = (count: 1 | 2 | 3) => {
    if (!menu) return;
    update((l) => {
      const page = l.pages[menu.page],
        row = page.rows[menu.row],
        extra = row.blocks.slice(count).filter(Boolean);
      row.columns = count;
      row.blocks = [
        ...row.blocks.slice(0, count),
        ...Array(Math.max(0, count - row.blocks.length)).fill(null),
      ];
      extra.forEach((b, i) =>
        page.rows.splice(menu.row + 1 + i, 0, {
          id: newId(),
          columns: 1,
          blocks: [b],
        }),
      );
    });
    setMenu(null);
  };
  const insertRow = (page: number, row: number, below: boolean) => {
    update((l) =>
      l.pages[page].rows.splice(row + (below ? 1 : 0), 0, {
        id: newId(),
        columns: 3,
        blocks: [null, null, null],
      }),
    );
    setMenu(null);
  };
  const addRow = (page: number) =>
    update((l) =>
      l.pages[page].rows.push({
        id: newId(),
        columns: 3,
        blocks: [null, null, null],
      }),
    );
  const addPage = () =>
    update((l) =>
      l.pages.push({
        id: newId(),
        rows: [{ id: newId(), columns: 3, blocks: [null, null, null] }],
      }),
    );
  return (
    <div className="mx-auto ">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">จัดแบบฟอร์มรายงาน</h2>
          <p className="text-sm text-slate-500">
            แตะช่องบนกระดาษเพื่อเพิ่มเนื้อหา · จุดสามจุดด้านซ้ายใช้จัดแถว ·
            บันทึกอัตโนมัติ
          </p>
        </div>
        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-white"
          >
            <FileSpreadsheet size={18} /> ดูรายงานเต็ม
          </button>
        )}
      </div>
      <div data-tour="form-canvas" className="overflow-x-auto rounded-2xl bg-slate-100 p-3 dark:bg-slate-950 sm:p-6">
        <div className="min-w-[560px]">
          <ReportPageCanvas
            layout={layout}
            date={date}
            onSlot={(page, row, slot) => {
              setSelected({ page, row, slot });
              setMenu(null);
            }}
            onRowMenu={(page, row) => {
              setMenu({ page, row });
              setSelected(null);
            }}
          />
        </div>
      </div>
      {layout.pages.map((p, i) => (
        <div
          key={p.id}
          className="mx-auto flex max-w-[210mm] justify-end gap-2 py-3"
        >
          <button
            type="button"
            onClick={() => addRow(i)}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700 dark:text-blue-300"
          >
            <Plus size={16} /> เพิ่มแถว หน้า {i + 1}
          </button>
          {layout.pages.length > 1 && (
            <button
              type="button"
              onClick={() => update((l) => l.pages.splice(i, 1))}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
            >
              ลบหน้า
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addPage}
        className="my-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 py-5 text-blue-700 dark:text-blue-300"
      >
        <Plus size={20} /> เพิ่มหน้ากระดาษ
      </button>
      {menu && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setMenu(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">จัดแถว</h3>
              <button onClick={() => setMenu(null)} aria-label="ปิด">
                <X size={20} />
              </button>
            </div>
            <p className="mb-2 text-sm text-slate-500">จำนวนช่องในแถว</p>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => changeColumns(n)}
                  className="rounded-lg border border-blue-200 py-3 text-blue-700 dark:text-blue-300"
                >
                  {n} ช่อง
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => insertRow(menu.page, menu.row, false)}
                className="rounded-lg border border-blue-200 py-3 text-sm text-blue-700"
              >
                + แทรกด้านบน
              </button>
              <button
                onClick={() => insertRow(menu.page, menu.row, true)}
                className="rounded-lg border border-blue-200 py-3 text-sm text-blue-700"
              >
                + แทรกด้านล่าง
              </button>
            </div>
            <button
              onClick={() => {
                update((l) => l.pages[menu.page].rows.splice(menu.row, 1));
                setMenu(null);
              }}
              className="mt-5 flex items-center gap-2 text-sm text-red-600"
            >
              <Trash2 size={16} /> ลบแถว
            </button>
          </div>
        </div>
      )}
      {selected && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-2 sm:p-5"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-slot-title"
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white sm:max-h-[calc(100dvh-2.5rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
              <div>
                <h3 id="report-slot-title" className="text-lg font-bold">เนื้อหาในช่องนี้</h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">กำลังแก้ช่องที่เลือกบนหน้ากระดาษที่ {selected.page + 1} · ระบบบันทึกให้ทันที</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="ปิด" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
            <div className="min-w-0">
            <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">1. เลือกสิ่งที่จะแสดง</p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              {choices.map((c) => (
                <button
                  key={c.type}
                  onClick={() => setBlock({ type: c.type })}
                  aria-pressed={block?.type === c.type}
                  className={`min-h-16 rounded-xl border p-3 text-left text-sm transition-colors ${block?.type === c.type ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:bg-blue-950/50 dark:text-blue-200" : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"}`}
                >
                  <span className="block font-semibold">{c.label}</span>
                  <span className="mt-0.5 block text-xs opacity-70">{c.hint}</span>
                </button>
              ))}
            </div>
            </div>
            <div className="min-w-0">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">2. กรอกรายละเอียด</p>
              {block && block.type !== "table" && block.type !== "divider" && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">จัดรูปแบบข้อความทั้งช่อง</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-900" aria-label="จัดตำแหน่งข้อความ">
                      {([{ value: "left", label: "ชิดซ้าย", Icon: AlignLeft }, { value: "center", label: "กึ่งกลาง", Icon: AlignCenter }, { value: "right", label: "ชิดขวา", Icon: AlignRight }] as const).map(({ value, label, Icon }) => (
                        <button key={value} type="button" title={label} aria-label={label} aria-pressed={(block.align || "left") === value} onClick={() => setBlock({ align: value })}
                          className={`grid size-10 place-items-center rounded-md ${(block.align || "left") === value ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Icon size={18} /></button>
                      ))}
                    </div>
                    <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600 dark:bg-slate-900" aria-label="ลักษณะตัวหนังสือ">
                      {([{ field: "bold", label: "ตัวหนา", Icon: Bold, active: block.bold !== false }, { field: "italic", label: "ตัวเอียง", Icon: Italic, active: block.italic === true }, { field: "underline", label: "ขีดเส้นใต้", Icon: Underline, active: block.underline === true }] as const).map(({ field, label, Icon, active }) => (
                        <button key={field} type="button" title={label} aria-label={label} aria-pressed={active} onClick={() => setBlock({ [field]: !active })}
                          className={`grid size-10 place-items-center rounded-md ${active ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Icon size={18} /></button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm dark:border-slate-600 dark:bg-slate-900">
                      ขนาด
                      <button type="button" aria-label="ลดขนาดตัวหนังสือ" onClick={() => setBlock({ fontSize: Math.max(8, (block.fontSize || 12) - 1) })} className="grid size-8 place-items-center rounded-md text-lg hover:bg-slate-100 dark:hover:bg-slate-800">−</button>
                      <input type="number" min={8} max={24} step={1} aria-label="ขนาดตัวหนังสือ" value={block.fontSize || 12}
                        onChange={(e) => setBlock({ fontSize: Math.min(24, Math.max(8, Number(e.target.value) || 12)) })}
                        className="w-12 bg-transparent text-center font-semibold outline-none" />
                      <button type="button" aria-label="เพิ่มขนาดตัวหนังสือ" onClick={() => setBlock({ fontSize: Math.min(24, (block.fontSize || 12) + 1) })} className="grid size-8 place-items-center rounded-md text-lg hover:bg-slate-100 dark:hover:bg-slate-800">+</button>
                    </label>
                  </div>
                </div>
              )}
              {!block && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">เลือกประเภทเนื้อหาทางซ้ายก่อน แล้วช่องกรอกจะปรากฏตรงนี้</div>}
              {block?.type === "divider" && <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">เส้นคั่นจะแสดงเต็มความกว้างของช่องบนหน้ากระดาษ</div>}
            {block?.type === "text" && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  พิมพ์ข้อความที่จะแสดง
                </label>
                <textarea
                  value={block.text || ""}
                  onChange={(e) => setBlock({ text: e.target.value })}
                  style={editorStyle}
                  placeholder={"ตัวอย่าง\nโรงเรียนบ้านไสขาม\nรายงานเงินคงเหลือประจำวัน"}
                  rows={9}
                  className="mt-2 min-h-52 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-sarabun text-lg leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">กด Enter เพื่อขึ้นบรรทัดใหม่ · ข้อความจะปรากฏในช่องที่เลือกบนหน้ากระดาษ</p>
              </div>
            )}
            {block?.type === "signature" && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  พิมพ์ข้อความลงชื่อและตำแหน่ง
                </label>
                <textarea
                  value={block.text ?? signatureText(block)}
                  onChange={(e) => setBlock({ text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Tab" || e.shiftKey) return;
                    e.preventDefault();
                    const field = e.currentTarget;
                    const start = field.selectionStart;
                    const end = field.selectionEnd;
                    const next = `${field.value.slice(0, start)}    ${field.value.slice(start)}`;
                    setBlock({ text: next });
                    requestAnimationFrame(() => field.setSelectionRange(start + 4, end + 4));
                  }}
                  style={editorStyle}
                  rows={9}
                  placeholder="พิมพ์ข้อความทั้งหมดด้วยตัวเอง"
                  className="mt-2 min-h-52 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-sarabun text-lg leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-blue-950"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">พิมพ์เส้นจุด ชื่อ และตำแหน่งได้ตามแบบของโรงเรียน · กด Tab เพื่อเว้นระยะ</p>
              </div>
            )}
            {block?.type === "table" && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    ขนาดตัวหนังสือในตาราง
                    <input
                      type="number"
                      min={8}
                      max={24}
                      step={1}
                      value={block.tableFontSize || 10}
                      onChange={(e) =>
                        setBlock({
                          tableFontSize: Math.min(
                            24,
                            Math.max(8, Number(e.target.value) || 10),
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    ขนาดตัวหนังสือหัวตาราง
                    <input
                      type="number"
                      min={8}
                      max={24}
                      step={1}
                      value={block.tableHeaderFontSize || 10}
                      onChange={(e) =>
                        setBlock({
                          tableHeaderFontSize: Math.min(
                            24,
                            Math.max(8, Number(e.target.value) || 10),
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900"
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">ชื่อหัวตาราง</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {defaultTableHeaders.map((label, i) => (
                      <label
                        key={i}
                        className="text-xs text-slate-600 dark:text-slate-300"
                      >
                        ช่องที่ {i + 1}
                        <textarea
                          value={block.tableHeaders?.[i] ?? label}
                          onChange={(e) => {
                            const headers = defaultTableHeaders.map(
                              (fallback, j) =>
                                block.tableHeaders?.[j] ?? fallback,
                            );
                            headers[i] = e.target.value;
                            setBlock({ tableHeaders: headers });
                          }}
                          rows={2}
                          className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-300">
                    จัดตำแหน่ง
                    <select
                      value={block.tableHeaderAlign || "center"}
                      onChange={(e) =>
                        setBlock({
                          tableHeaderAlign: e.target
                            .value as ReportBlock["tableHeaderAlign"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900"
                    >
                      <option value="left">ซ้าย</option>
                      <option value="center">กลาง</option>
                      <option value="right">ขวา</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-600 dark:text-slate-300">
                    สีพื้น
                    <select
                      value={block.tableHeaderColor || "white"}
                      onChange={(e) =>
                        setBlock({
                          tableHeaderColor: e.target
                            .value as ReportBlock["tableHeaderColor"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-base text-slate-900"
                    >
                      <option value="white">ขาว</option>
                      <option value="blue">ฟ้าอ่อน</option>
                      <option value="gray">เทาอ่อน</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      checked={block.tableHeaderBold !== false}
                      onChange={(e) =>
                        setBlock({ tableHeaderBold: e.target.checked })
                      }
                    />{" "}
                    ตัวหนา
                  </label>
                </div>
              </div>
            )}
            {block?.type === "date" && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    ข้อความวันที่
                  </label>
                  <textarea
                    value={
                      block.text ??
                      (block.dateMode === "manual"
                        ? block.manualDate || ""
                        : "วันที่ {วัน} เดือน {เดือน} พ.ศ. {ปี}")
                    }
                    onChange={(e) => setBlock({ text: e.target.value })}
                    style={editorStyle}
                    rows={3}
                    placeholder="พิมพ์รูปแบบวันที่เอง"
                    className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 font-sarabun text-lg text-slate-900 placeholder:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    ใช้ {"{วัน}"}, {"{เดือน}"}, {"{ปี}"} แยกตำแหน่งได้ตามต้องการ
                    หรือพิมพ์เองทั้งหมด
                  </p>
                </div>
                {/\{(?:วัน|เดือน|ปี|วันที่)\}/.test(
                  block.text ?? "วันที่ {วัน} เดือน {เดือน} พ.ศ. {ปี}",
                ) && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      วันที่ที่จะแสดง
                    </label>
                    <select
                      value={
                        block.dateMode === "manual"
                          ? "report"
                          : block.dateMode || "report"
                      }
                      onChange={(e) =>
                        setBlock({
                          dateMode: e.target.value as ReportBlock["dateMode"],
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900"
                    >
                      <option value="report">วันที่รายงาน</option>
                      <option value="today">วันนี้</option>
                      <option value="previous">วันก่อนวันที่รายงาน</option>
                      <option value="next">วันถัดจากวันที่รายงาน</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            </div>
            </div>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
              {block ? <button type="button" onClick={() => setBlock(null)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">ลบเนื้อหาในช่อง</button> : <span />}
              <button type="button" onClick={() => setSelected(null)} className="min-w-28 rounded-xl bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800">เสร็จสิ้น</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
