import { useEffect, useRef, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  LogIn,
  School,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { auth } from "../../config/firebase";
import { getProfile } from "../../config/services/users.service";
import {
  acceptSchoolInvitation,
  previewSchoolInvitation,
  schoolTeamError,
  type InvitationPreview,
} from "../../config/services/school-team.service";
import { signInWithGoogle } from "../../features/auth/signInWithGoogle";
import BrandLogo from "../../shared/components/BrandLogo";
import { clearApiReadCache } from "../../shared/funtion/apiRequestCache";
import {
  forgetSchoolInvitation,
  pendingSchoolInvitation,
  rememberSchoolInvitation,
} from "../../shared/funtion/schoolInvitationLink";

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
function readToken() {
  const storage = session();
  return pendingSchoolInvitation(
    window.location.hash,
    storage || { getItem: () => null, removeItem: () => {} },
  );
}
export default function SchoolInvitationPage() {
  const [token] = useState(readToken);
  const [user, setUser] = useState<User | null>(null);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mode = preview?.billingMode;
  const [success, setSuccess] = useState(false);
  const [retry, setRetry] = useState(0);
  const accepting = useRef(false);
  const [dark] = useState(() => {
    try {
      return localStorage.getItem("thaiteacher-theme") === "dark";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const storage = session();
    if (token && storage && rememberSchoolInvitation(token, storage)) {
      // Remove the fragment from the address bar after preserving it for Safari's
      // same-tab OAuth return. It is never put in a query string or API URL.
      if (window.location.hash)
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
    }
  }, [token]);
  useEffect(() => {
    if (!token) return;
    void getRedirectResult(auth).catch(() =>
      setError(
        "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หากเปิดผ่าน LINE หรือ Messenger ให้เปิดลิงก์ใน Safari หรือ Chrome โดยตรง",
      ),
    );
  }, [token]);
  useEffect(() => {
    if (!token) return;
    let active = true;
    let sequence = 0;
    const unsubscribe = onAuthStateChanged(auth, (current) => {
      const request = ++sequence;
      setUser(current);
      setPreview(null);
      setError("");
      if (!current) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void (async () => {
        try {
          // Creates a signup contract for a new Google account without opening the
          // finance workspace or writing any empty school data before joining.
          await getProfile(current, true);
          if (!active || request !== sequence) return;
          const value = await previewSchoolInvitation(current, token);
          if (active && request === sequence) setPreview(value);
        } catch (cause) {
          if (active && request === sequence) setError(schoolTeamError(cause));
        } finally {
          if (active && request === sequence) setLoading(false);
        }
      })();
    });
    return () => {
      active = false;
      ++sequence;
      unsubscribe();
    };
  }, [token, retry]);
  async function login() {
    const storage = session();
    if (!storage || !rememberSchoolInvitation(token, storage)) {
      setError(
        "เบราว์เซอร์ไม่อนุญาตให้เก็บคำเชิญชั่วคราว กรุณาเปิดลิงก์นี้ใน Safari หรือ Chrome โดยตรง",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch {
      setError(
        "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่ หรือเปิดลิงก์ใน Safari / Chrome โดยตรง",
      );
    } finally {
      setBusy(false);
    }
  }
  async function switchAccount() {
    setBusy(true);
    setError("");
    try {
      await signOut(auth);
      clearApiReadCache();
    } catch {
      setError("เปลี่ยนบัญชีไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!user || !preview || !mode || accepting.current) return;
    accepting.current = true;
    setBusy(true);
    setError("");
    try {
      await acceptSchoolInvitation(user, token);
      const storage = session();
      if (storage) forgetSchoolInvitation(storage);
      clearApiReadCache();
      setSuccess(true);
    } catch (cause) {
      setError(schoolTeamError(cause));
    } finally {
      accepting.current = false;
      setBusy(false);
    }
  }
  function exit() {
    const storage = session();
    if (storage) forgetSchoolInvitation(storage);
    window.location.assign("/finance/school-finance");
  }
  const button =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className={dark ? "dark" : ""}>
      <main className="min-h-dvh bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 px-4 py-7 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950 dark:text-slate-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mx-auto mb-7 w-52">
            <BrandLogo className="h-auto w-full" />
          </div>
          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/5 dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 bg-blue-50/50 p-5 dark:border-slate-800 dark:bg-blue-950/20 sm:p-8">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                <ShieldCheck size={15} />
                คำเชิญเฉพาะอีเมล · ใช้ได้ครั้งเดียว
              </span>
              <h1 className="text-2xl font-bold sm:text-3xl">
                {success
                  ? "เข้าร่วมโรงเรียนสำเร็จ"
                  : "รับคำเชิญเข้าร่วมโรงเรียน"}
              </h1>
            </header>
            <div className="space-y-5 p-5 sm:p-8">
              {!token ? (
                <>
                  <p
                    role="alert"
                    className="rounded-xl bg-amber-50 p-4 leading-7 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    ลิงก์คำเชิญไม่ครบหรือหมดเวลารอเข้าสู่ระบบ
                    กรุณาเปิดลิงก์จากผู้เชิญอีกครั้ง หรือขอคำเชิญใหม่
                  </p>
                  <button className={button} onClick={exit}>
                    ไปหน้าระบบ
                  </button>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={48} className="text-emerald-600" />
                  <div>
                    <h2 className="text-xl font-bold">{preview?.schoolName}</h2>
                    <p className="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">
                      บัญชี {user?.email}
                    </p>
                  </div>
                  <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {mode === "individual"
                      ? "ผู้เชิญกำหนดให้แต่ละบัญชีจ่ายส่วนของตัวเอง กรุณาชำระและรออนุมัติเพื่อเปิดสิทธิ์แก้ไขข้อมูล"
                      : preview?.sponsoredActive
                        ? "ผู้เชิญกำหนดให้ใช้สิทธิ์จากบัญชีหลัก และเข้าร่วมใช้ข้อมูลโรงเรียนแล้ว"
                        : "คุณเข้าร่วมโรงเรียนแล้ว โดยแก้ไขข้อมูลได้เมื่อบัญชีหลักมีแพ็กเกจที่ใช้งานได้"}{" "}
                    หากเป็นบัญชีใหม่
                    ระบบจะให้กรอกโปรไฟล์และยอมรับข้อตกลงก่อนเริ่มใช้งาน
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {mode === "individual" && (
                      <button
                        className={button}
                        onClick={() => window.location.assign("/billing")}
                      >
                        ชำระเงินเพื่อเปิดใช้งาน
                      </button>
                    )}
                    <button
                      className={
                        mode === "individual"
                          ? "min-h-12 rounded-xl border border-slate-200 px-5 py-3 font-semibold dark:border-slate-700"
                          : button
                      }
                      onClick={exit}
                    >
                      เข้าสู่โรงเรียน
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {user && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <UserRound size={14} />
                          บัญชีที่กำลังใช้
                        </p>
                        <p className="mt-1 break-all font-semibold">
                          {user.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy || loading}
                        onClick={() => {
                          void switchAccount();
                        }}
                        className="min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:text-blue-300"
                      >
                        เปลี่ยนบัญชี
                      </button>
                    </div>
                  )}
                  {error && (
                    <div
                      role="alert"
                      className="space-y-2 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                    >
                      <p>{error}</p>
                      <p>
                        ตรวจว่าใช้อีเมล Google ที่ผู้เชิญระบุ
                        คำเชิญต้องยังไม่หมดอายุหรือถูกยกเลิก
                      </p>
                      {user && (
                        <button
                          disabled={busy || loading}
                          className="min-h-10 font-semibold underline disabled:opacity-50"
                          onClick={() => setRetry((value) => value + 1)}
                        >
                          ตรวจสอบคำเชิญอีกครั้ง
                        </button>
                      )}
                    </div>
                  )}
                  {loading ? (
                    <div
                      role="status"
                      className="flex min-h-32 items-center justify-center gap-3 text-slate-500"
                    >
                      <Loader2 className="animate-spin" size={22} />
                      กำลังตรวจสอบคำเชิญ…
                    </div>
                  ) : !user ? (
                    <div className="space-y-5">
                      <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                        เข้าสู่ระบบด้วยอีเมลที่ถูกเชิญเพื่อดูชื่อโรงเรียน
                        ระบบจะยังไม่เพิ่มคุณเป็นสมาชิกจนกว่าคุณกดยืนยัน
                      </p>
                      <button
                        type="button"
                        className={`${button} w-full`}
                        disabled={busy}
                        onClick={() => {
                          void login();
                        }}
                      >
                        {busy ? (
                          <Loader2 size={19} className="animate-spin" />
                        ) : (
                          <LogIn size={19} />
                        )}
                        เข้าสู่ระบบด้วย Google เพื่อรับคำเชิญ
                      </button>
                    </div>
                  ) : (
                    preview && (
                      <>
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
                          <School
                            size={25}
                            className="mb-3 text-blue-600 dark:text-blue-300"
                          />
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            โรงเรียนที่เชิญคุณ
                          </p>
                          <h2 className="mt-1 text-xl font-bold">
                            {preview.schoolName}
                          </h2>
                          <p className="mt-2 text-sm">
                            บัญชีหลัก: {preview.ownerName}
                          </p>
                          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Clock3 size={14} />
                            หมดอายุ{" "}
                            {new Date(preview.expiresAt).toLocaleString(
                              "th-TH",
                              { timeZone: "Asia/Bangkok" },
                            )}
                          </p>
                        </div>
                        <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                          <h3 className="font-bold">
                            รูปแบบชำระเงินที่ผู้เชิญกำหนด
                          </h3>
                          {mode === "sponsored" ? (
                            <>
                              <p className="font-semibold">
                                บัญชีหลักจ่ายเต็ม · คุณไม่ต้องจ่ายเอง
                              </p>
                              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {preview.sponsoredActive
                                  ? "บัญชีหลักมีแพ็กเกจที่ใช้งานได้"
                                  : "บัญชีหลักยังไม่มีแพ็กเกจที่ใช้งานได้ คุณดูข้อมูลได้ แต่ยังแก้ไขไม่ได้จนกว่าบัญชีหลักชำระ"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold">
                                หารกัน 10 ส่วน · ส่วนของคุณ{" "}
                                {(
                                  preview.individualPriceSatang / 100
                                ).toLocaleString("th-TH", {
                                  minimumFractionDigits: 2,
                                })}{" "}
                                บาท/เดือน
                              </p>
                              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                                รวมบัญชีหลักด้วย แต่ละคนจ่ายตามราคาประจำบัญชีหาร
                                10 คงที่ ต้องชำระและผ่านอนุมัติก่อนแก้ไขข้อมูล
                              </p>
                            </>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            รูปแบบเดียวกันทั้งโรงเรียน กำหนดโดยบัญชีหลัก
                            ผู้รับเปลี่ยนเองไม่ได้
                          </p>
                        </section>
                        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                          การยืนยันจะเชื่อมบัญชีนี้กับข้อมูลร่วมของโรงเรียน
                          หากมีข้อมูลการเงินหรือสมาชิกโรงเรียนเดิม
                          ระบบจะไม่ย้ายให้อัตโนมัติ
                        </p>
                        <button
                          className={`${button} w-full`}
                          disabled={busy || !mode}
                          onClick={() => {
                            void accept();
                          }}
                        >
                          {busy ? (
                            <Loader2 size={19} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={19} />
                          )}
                          ยืนยันเข้าร่วมโรงเรียนนี้
                        </button>
                      </>
                    )
                  )}
                </>
              )}
            </div>
          </section>
          <button
            type="button"
            onClick={exit}
            className="mx-auto mt-5 flex min-h-11 items-center gap-2 px-3 text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400"
          >
            <ArrowLeft size={16} />
            กลับหน้าระบบ
          </button>
        </div>
      </main>
    </div>
  );
}
