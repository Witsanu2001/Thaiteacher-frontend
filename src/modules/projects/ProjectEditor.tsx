import { Plus, Trash2, X } from "lucide-react";
import {
  projectBudget,
  newId,
  type ProjectActivity,
  type SchoolProject,
} from "./projectModel";
import ProjectBudgetField from "./ProjectBudgetField";

const input =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800";

export default function ProjectEditor({
  draft,
  categories,
  onChange,
  onClose,
  onSave,
  hasExpense,
  demo,
  saving,
  isEditing,
  tutorialPreview = false,
}: {
  draft: SchoolProject;
  categories: string[];
  onChange: (next: SchoolProject) => void;
  onClose: () => void;
  onSave: () => void;
  hasExpense: (activityId: string) => boolean;
  demo: boolean;
  saving: boolean;
  isEditing: boolean;
  tutorialPreview?: boolean;
}) {
  const updateActivity = (
    activityId: string,
    patch: Partial<ProjectActivity>,
  ) =>
    onChange({
      ...draft,
      activities: draft.activities.map((item) =>
        item.id === activityId ? { ...item, ...patch } : item,
      ),
    });
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/60 sm:place-items-center sm:p-4">
      <section
        data-tour="tour-active-modal"
        role="dialog"
        aria-modal="true"
        aria-label="แก้ไขโครงการ"
        className="max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900 sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">ข้อมูลโครงการ</h3>
            <p className="mt-1 text-sm text-slate-500">
              เพิ่มกิจกรรม แล้วกำหนดประเภทเงินและวงเงินในแต่ละกิจกรรม
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label data-tour="project-name" className="sm:col-span-2">
            ชื่อโครงการ
            <input
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              className={`${input} mt-1`}
            />
          </label>
          <label>
            ฝ่าย / กลุ่มงาน
            <input
              value={draft.department}
              onChange={(event) =>
                onChange({ ...draft, department: event.target.value })
              }
              className={`${input} mt-1`}
            />
          </label>
          <label>
            ผู้รับผิดชอบ
            <input
              value={draft.owner}
              onChange={(event) =>
                onChange({ ...draft, owner: event.target.value })
              }
              className={`${input} mt-1`}
            />
          </label>
        </div>
        <div className="mt-7 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-bold">กิจกรรมในโครงการ</h4>
            <p className="text-sm text-slate-500">
              แต่ละกิจกรรมเลือกแหล่งเงินของตัวเองได้
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                activities: [
                  ...draft.activities,
                  { id: newId(), name: "", allocations: [] },
                ],
              })
            }
            className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600"
          >
            <Plus size={16} />
            เพิ่มกิจกรรม
          </button>
        </div>
        <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">วงเงินโครงการรวมจากวงเงินของทุกกิจกรรม: {new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(projectBudget(draft))} บาท</p>
        <div className="mt-3 space-y-4">
          {draft.activities.map((activity, index) => (
            <div
              key={activity.id}
              className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
            >
              <div className="flex items-start gap-2">
                <label className="min-w-0 flex-1 text-sm font-semibold">
                  กิจกรรมที่ {index + 1}
                  <input
                    value={activity.name}
                    onChange={(event) =>
                      updateActivity(activity.id, { name: event.target.value })
                    }
                    placeholder="ชื่อกิจกรรม"
                    className={`${input} mt-1`}
                  />
                </label>
                <button
                  type="button"
                  aria-label="ลบกิจกรรม"
                  disabled={hasExpense(activity.id)}
                  onClick={() =>
                    onChange({
                      ...draft,
                      activities: draft.activities.filter(
                        (item) => item.id !== activity.id,
                      ),
                    })
                  }
                  className="mt-6 rounded-lg p-2 text-rose-600 disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    แหล่งเงินของกิจกรรมนี้
                  </p>
                  <p className="text-xs text-slate-500">
                    เลือกประเภทเงินจากรายงานเงินคงเหลือประจำวัน
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!categories.length}
                  onClick={() =>
                    updateActivity(activity.id, {
                      allocations: [
                        ...activity.allocations,
                        { id: newId(), category: categories[0], budget: 0 },
                      ],
                    })
                  }
                  className="shrink-0 text-sm font-bold text-blue-600 disabled:opacity-40"
                >
                  + เพิ่ม
                </button>
              </div>
              {!categories.length && (
                <p className="mt-2 text-xs text-amber-600">
                  ต้องมีรายงานเงินคงเหลือประจำวันก่อนเลือกประเภทเงิน
                </p>
              )}
              {activity.allocations.map((allocation, allocationIndex) => (
                <div
                  key={allocation.id}
                  className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800 sm:grid-cols-[1fr_9rem_auto]"
                >
                  <select
                    aria-label="ประเภทเงิน"
                    value={allocation.category}
                    onChange={(event) =>
                      updateActivity(activity.id, {
                        allocations: activity.allocations.map((item) =>
                          item.id === allocation.id
                            ? { ...item, category: event.target.value }
                            : item,
                        ),
                      })
                    }
                    className={input}
                  >
                    <option value="">ยังไม่เลือกประเภทเงิน</option>
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  {allocation.sourceLabel && <p className="text-xs text-slate-500 sm:col-span-3">จาก Excel: {allocation.sourceLabel} · เลือกประเภทเงินในรายงานก่อนบันทึกค่าใช้จ่าย</p>}
                  <ProjectBudgetField
                    label="วงเงินของกิจกรรม"
                    tourId={index === 0 && allocationIndex === 0 ? "project-activity-budget" : undefined}
                    value={allocation.budget}
                    onChange={(value) =>
                      updateActivity(activity.id, {
                        allocations: activity.allocations.map((item) =>
                          item.id === allocation.id
                            ? { ...item, budget: value }
                            : item,
                        ),
                      })
                    }
                    className={input}
                  />
                  <button
                    type="button"
                    aria-label="ลบแหล่งเงิน"
                    disabled={
                      hasExpense(activity.id) &&
                      activity.allocations.length === 1
                    }
                    onClick={() =>
                      updateActivity(activity.id, {
                        allocations: activity.allocations.filter(
                          (item) => item.id !== allocation.id,
                        ),
                      })
                    }
                    className="rounded-lg p-2 text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-slate-700"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || tutorialPreview}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {tutorialPreview ? "ตัวอย่าง ไม่บันทึก" : saving ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : demo ? "เพิ่มในตัวอย่าง" : "บันทึกโครงการ"}
          </button>
        </div>
      </section>
    </div>
  );
}
