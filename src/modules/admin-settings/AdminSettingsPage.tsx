import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { Clock3, Loader2, Save, ShieldCheck } from "lucide-react";
import {
  getSystemSettings,
  saveSystemSettings,
  type SystemSettings,
} from "../../config/services/system.service";
import AdminHeader from "../../shared/components/AdminHeader";
import { setPublicTrialDays } from "../../shared/funtion/useTrialDays";
export default function AdminSettingsPage({
  user,
  onMenu,
  dark,
  onToggleDark,
}: {
  user: User;
  onMenu: () => void;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const [settings, setSettings] = useState<SystemSettings | null>(null),
    [days, setDays] = useState("9"),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    let active = true;
    void getSystemSettings(user)
      .then((value) => {
        if (active) {
          setSettings(value);
          setDays(String(value.trialDays));
        }
      })
      .catch(() => {
        if (active) setError("โหลดการตั้งค่าไม่สำเร็จ กรุณาตรวจสิทธิ์และการเชื่อมต่อ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  const save = async () => {
    const value = Number(days);
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      setError("กำหนดระยะเวลาทดลองตั้งแต่ 1 ถึง 365 วัน");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await saveSystemSettings(user, value);
      setSettings(updated);
      setDays(String(updated.trialDays));
      setPublicTrialDays(updated.trialDays);
      setSuccess("บันทึกแล้ว บัญชีที่สมัครใหม่จะได้รับระยะเวลาทดลองตามนี้");
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <AdminHeader
        title="ตั้งค่าระบบ"
        onMenu={onMenu}
        dark={dark}
        onToggleDark={onToggleDark}
      />
      <main className="mx-auto max-w-4xl p-4 sm:p-8">
        {loading ? (
          <div
            role="status"
            aria-label="กำลังโหลด"
            className="grid min-h-80 place-items-center"
          >
            <Loader2 className="animate-spin text-blue-600" size={30} />
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">
                <Clock3 />
              </span>
              <div>
                <h2 className="text-xl font-bold">ระยะเวลาทดลองใช้งาน</h2>
                <p className="mt-1 text-sm text-slate-500">
                  กำหนดสิทธิ์เริ่มต้นสำหรับบัญชีใหม่
                </p>
              </div>
            </div>
            <form
              className="mt-7 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!saving) void save();
              }}
            >
              <label className="grid max-w-sm gap-2 text-sm font-semibold">
                จำนวนวันที่ให้ทดลองใช้
                <div className="flex items-center gap-3">
                  <input
                    aria-label="จำนวนวันทดลองใช้"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={days}
                    onChange={(event) => {
                      setDays(event.target.value);
                      setSuccess("");
                    }}
                    disabled={saving || !settings}
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg tabular-nums dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span>วัน</span>
                </div>
              </label>
              <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                <ShieldCheck size={20} className="mt-0.5 shrink-0" />
                <p>
                  เริ่มนับจากวันสร้างบัญชีครั้งแรก การเปลี่ยนค่านี้มีผลเฉพาะบัญชีที่สมัครใหม่
                  บัญชีเดิมยังใช้ระยะเวลาที่ได้รับไว้ และไม่กระทบแพ็กเกจชำระเงินหรือฟรีตลอดชีพ
                </p>
              </div>
              {settings?.updatedAt && (
                <p className="text-xs text-slate-500">
                  บันทึกล่าสุด{" "}
                  {new Date(settings.updatedAt).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  })}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-rose-600">
                  {error}
                </p>
              )}
              {success && (
                <p role="status" className="text-sm text-emerald-600">
                  {success}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  saving || !settings || Number(days) === settings.trialDays
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                บันทึกการตั้งค่า
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
