import { useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDocFromServer, type Timestamp } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import {
  ArrowRight,
  Clock3,
  GraduationCap,
  LogOut,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { auth, db, storage } from "../../config/firebase";
import {
  clearScopedDirty,
  clearStorageForUser,
  configureStorageSync,
  isScopedDirty,
  readScopedSnapshot,
  replaceScopedSnapshot,
  setStorageUser,
  setViewingUser,
} from "../../shared/funtion/scopedStorage";
import { loadAppState, writeAppState } from "../../config/services/app-state.service";
import {
  createPaymentRequest,
  acceptLegal,
  getLegalAcceptance,
  getPaymentRequests,
  getProfile,
  markOnboarding,
  recordVisit,
  updateProfile,
  type PaymentRequest,
  type UserProfile,
} from "../../config/services/users.service";
import { legalVersion, privacySections, termsIntroduction, termsSections } from "../../shared/legalContent";
import DemoApp from "./DemoApp";

type Profile = Omit<UserProfile, "createdAt" | "paidUntil"> & {
  createdAt: Timestamp | null;
  paidUntil?: Timestamp | null;
};
const visitSessionIds = new Map<string, string>();
const toProfile = (value: UserProfile): Profile => ({
  ...value,
  createdAt: value.createdAt
    ? ({ toMillis: () => new Date(value.createdAt!).getTime() } as Timestamp)
    : null,
  paidUntil: value.paidUntil
    ? ({ toMillis: () => new Date(value.paidUntil!).getTime() } as Timestamp)
    : null,
});

const hasRegistration = (
  value: Pick<UserProfile, "displayName" | "position" | "schoolName">,
) =>
  Boolean(
    value.displayName?.trim() &&
    value.position?.trim() &&
    value.schoolName?.trim(),
  );

async function loadProfile(user: User): Promise<UserProfile> {
  const apiProfile = await getProfile(user);
  const token = await user.getIdTokenResult();
  const profile = {
    ...apiProfile,
    role:
      token.claims.role === "supperAdmin"
        ? ("supperAdmin" as const)
        : ("user" as const),
  };
  if (profile.uid && profile.uid !== user.uid)
    throw new Error("profile_uid_mismatch");
  if (
    hasRegistration(profile) ||
    profile.status === "clearing" ||
    profile.status === "cleared"
  )
    return profile;

  // Read only the signed-in user's document. This recovers an existing profile
  // if the API returned an incomplete representation of that same document.
  try {
    const snapshot = await getDocFromServer(doc(db, "users", user.uid));
    if (!snapshot.exists()) return profile;
    const saved = snapshot.data();
    if (!hasRegistration(saved as UserProfile)) return profile;
    return {
      ...profile,
      displayName: saved.displayName,
      phone: saved.phone || profile.phone,
      position: saved.position,
      schoolName: saved.schoolName,
    };
  } catch {
    return profile;
  }
}

async function syncOwnerState(user: User, version: number) {
  const remote = await loadAppState(user);
  const local = readScopedSnapshot(user.uid, version);
  const merged = { ...remote };
  for (const [key, value] of Object.entries(local)) {
    if (
      key === "school-finances-v2" ||
      key.startsWith("school-finances-conflict-backup:")
    ) {
      merged[key] = value;
      continue;
    }
    if (isScopedDirty(user.uid, version, key) && remote[key] !== undefined && remote[key] !== value) {
      localStorage.setItem(`thaiteacher-conflict-backup:${user.uid}:${version}:${key}:${Date.now()}`, value);
      clearScopedDirty(user.uid, version, key);
      continue;
    }
    if (isScopedDirty(user.uid, version, key) && remote[key] === value) {
      clearScopedDirty(user.uid, version, key);
      continue;
    }
    if (remote[key] === undefined) {
      await writeAppState(user, key, value);
      clearScopedDirty(user.uid, version, key);
      merged[key] = value;
    }
  }
  replaceScopedSnapshot(user.uid, version, merged);
}

const DAY = 24 * 60 * 60 * 1000;
const paymentAmount = Number(import.meta.env.VITE_PAYMENT_AMOUNT || 0);
const paymentQrUrl = import.meta.env.VITE_PAYMENT_QR_URL || "";
const field =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

export default function AuthGate({
  children,
}: {
  children: (
    profile: Profile,
    accessLabel: string,
    accessState: "trial" | "paid" | "lifetime" | "expired",
    onSignOut: () => void,
    user: User,
    onProfileSaved: (profile: UserProfile) => void,
  ) => ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missingAdminClaim, setMissingAdminClaim] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);
  const [legalError, setLegalError] = useState("");
  const [acceptTermsChecked, setAcceptTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [legalStep, setLegalStep] = useState<1 | 2>(1);
  const [showDemo, setShowDemo] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    position: "",
    schoolName: "",
  });
  const [slip, setSlip] = useState<File | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void getRedirectResult(auth).catch((authError) => {
      console.error("Google redirect sign-in failed", authError);
      setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่สำเร็จให้เปิดเว็บใน Safari โดยตรง");
    });
  }, []);

  useEffect(() => {
    let authRequestId = 0;
    const unsubscribeAuth = onAuthStateChanged(auth, async (current) => {
      const requestId = ++authRequestId;
      setStorageUser(null);
      setViewingUser(null);
      configureStorageSync(null);
      setUser(current);
      setProfile(null);
      setPayments([]);
      setError("");
      setMissingAdminClaim(false);
      setLegalAccepted(null);
      setLegalError("");
      setLegalStep(1);
      if (!current) {
        visitSessionIds.clear();
        setShowDemo(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Google sign-in has already succeeded at this point. Load the profile
        // independently so a payment API outage cannot make sign-in look failed.
        const value = await loadProfile(current);
        if (requestId !== authRequestId) return;
        if (value.role !== "supperAdmin") {
          try {
            const saved = await getDocFromServer(doc(db, "users", current.uid));
            if (requestId !== authRequestId) return;
            if (
              saved.exists() &&
              ["supperAdmin", "SupperAdmin"].includes(saved.data().role)
            )
              setMissingAdminClaim(true);
          } catch {
            /* The account still uses its verified token role. */
          }
        }
        if (value.status === "clearing" || value.status === "cleared")
          clearStorageForUser(current.uid);
        else {
          setStorageUser(current.uid, value.dataVersion || 0);
          configureStorageSync((uid, key, data) =>
            key === "school-finances-v2" ||
            key.startsWith("school-finances-conflict-backup:")
              ? Promise.resolve()
              : writeAppState(
                  current,
                  key,
                  data,
                  uid === current.uid ? undefined : uid,
                ),
          );
          try {
            await syncOwnerState(current, value.dataVersion || 0);
            if (requestId !== authRequestId) return;
          } catch (syncError) {
            console.error("Failed to sync owner state", syncError);
          }
        }
        setProfile(toProfile(value));
        const demoSeenLocally = localStorage.getItem(`thaiteacher-demo-seen:${current.uid}`) === "1";
        if (demoSeenLocally && !value.demoSeen) void markOnboarding(current, "demo").catch(() => undefined);
        setShowDemo(value.role !== "supperAdmin" && !value.demoSeen && !demoSeenLocally);
        if (value.role !== "supperAdmin") {
          const sessionId = visitSessionIds.get(current.uid) || crypto.randomUUID();
          visitSessionIds.set(current.uid, sessionId);
          void recordVisit(current, sessionId).catch(() => undefined);
        }
        setForm({
          displayName: value.displayName || current.displayName || "",
          phone: value.phone || "",
          position: value.position || "",
          schoolName: value.schoolName || "",
        });
        setLoading(false);
        if (value.status === "clearing" || value.status === "cleared") return;
        try {
          const paymentItems = await getPaymentRequests(current);
          if (requestId !== authRequestId) return;
          setPayments(paymentItems);
        } catch {
          if (requestId === authRequestId)
            setError("เข้าสู่ระบบแล้ว แต่โหลดรายการชำระเงินไม่ได้ กรุณาลองใหม่ภายหลัง");
        }
      } catch {
        if (requestId === authRequestId) {
          setError("เข้าสู่ระบบ Google แล้ว แต่โหลดโปรไฟล์จาก users-service ไม่สำเร็จ กรุณาตรวจสอบ service และ Firestore");
          setLoading(false);
        }
      }
    });
    return () => {
      authRequestId++;
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const refreshInterval = 10 * 60_000;
    let lastRefreshAt = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshAt < refreshInterval) return;
      lastRefreshAt = Date.now();
      void loadProfile(user)
        .then(async (value) => {
          if (value.status === "clearing" || value.status === "cleared")
            clearStorageForUser(user.uid);
          else {
            setStorageUser(user.uid, value.dataVersion || 0);
            await syncOwnerState(user, value.dataVersion || 0);
          }
          setProfile(toProfile(value));
        })
        .catch((syncError) => {
          console.error("Failed to refresh owner state", syncError);
        });
    };
    const timer = window.setInterval(refresh, refreshInterval);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile || legalAccepted !== null || profile.role === "supperAdmin" || profile.status === "clearing" || profile.status === "cleared" || !hasRegistration(profile)) return;
    let active = true;
    void getLegalAcceptance(user)
      .then(result => { if (active) { setLegalAccepted(result.accepted); setLegalError(""); } })
      .catch(() => { if (active) setLegalError("ตรวจสอบการยอมรับข้อตกลงไม่สำเร็จ กรุณาลองใหม่"); });
    return () => { active = false; };
  }, [user, profile, legalAccepted]);

  const confirmLegal = async () => {
    if (!user || !acceptTermsChecked || !privacyChecked) return;
    setBusy(true);
    setLegalError("");
    try {
      await acceptLegal(user, legalVersion);
      setLegalAccepted(true);
    } catch {
      setLegalError("บันทึกการยอมรับไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally { setBusy(false); }
  };
  const retryLegal = () => {
    if (!user) return;
    setLegalError("");
    void getLegalAcceptance(user)
      .then(result => setLegalAccepted(result.accepted))
      .catch(() => setLegalError("ตรวจสอบการยอมรับข้อตกลงไม่สำเร็จ กรุณาลองใหม่"));
  };

  const login = async () => {
    setBusy(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const isIPadOrIPhone = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isIPadOrIPhone && window.location.hostname === "thaiteacher-app.web.app") {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (authError) {
      console.error("Google sign-in failed", authError);
      setError("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง หากเปิดผ่าน Messenger ให้เปิดใน Safari โดยตรง");
    } finally {
      setBusy(false);
    }
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const value = await updateProfile(user, {
        displayName: form.displayName.trim(),
        phone: form.phone.trim(),
        position: form.position.trim(),
        schoolName: form.schoolName.trim(),
      });
      setProfile(toProfile(value));
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };
  const submitSlip = async () => {
    if (!user || !slip || !paymentAmount || !paymentQrUrl) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        slip.type,
      ) ||
      slip.size > 10 * 1024 * 1024
    ) {
      setError("แนบไฟล์ JPG, PNG, WebP หรือ PDF ขนาดไม่เกิน 10 MB");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const paymentId = crypto.randomUUID().replaceAll("-", "");
      const extension =
        slip.type === "application/pdf"
          ? "pdf"
          : slip.type === "image/png"
            ? "png"
            : slip.type === "image/webp"
              ? "webp"
              : "jpg";
      const slipPath = `payment-slips/${user.uid}/${paymentId}.${extension}`;
      await uploadBytes(ref(storage, slipPath), slip, {
        contentType: slip.type,
      });
      const payment = await createPaymentRequest(user, {
        id: paymentId,
        amount: paymentAmount,
        slipPath,
      });
      setPayments((current) => [payment, ...current]);
      setSlip(null);
    } catch {
      setError("ส่งสลิปไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <span role="status" aria-label="กำลังตรวจสอบบัญชี" className="size-10 motion-safe:animate-spin rounded-full border-[3px] border-blue-200/40 border-t-sky-300"/>
      </main>
    );
  if (!user) return <DemoApp onLogin={() => void login()} loginError={error} />;
  if (!profile)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-slate-800 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-white sm:p-9">
          <img
            src="/haiteacher-brand.png"
            alt="HaiTeacher"
            className="mx-auto mb-5 w-48 rounded-xl bg-white p-2"
          />
          <h1 className="text-center text-2xl font-bold">
            ยินดีต้อนรับสู่ ThaiTeacher
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            เข้าสู่ระบบเพื่อจัดการการเงินของโรงเรียน ทดลองใช้งานฟรี 9
            วันนับจากครั้งแรกที่เข้าสู่ระบบ
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            >
              {error}
            </p>
          )}
          {!user && (
            <>
              <button
                onClick={login}
                disabled={busy}
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <span className="grid size-6 place-items-center rounded-full bg-white font-bold text-blue-600">
                  G
                </span>{" "}
                เข้าสู่ระบบด้วย Google <ArrowRight size={18} />
              </button>
              <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
                หน้าต่างถัดไปเลือกบัญชีเดิมหรือกด “ใช้บัญชีอื่น” ได้
              </p>
            </>
          )}
          {user && (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-center text-xs text-slate-500">
                บัญชีที่เข้าสู่ระบบ: {user.email}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full text-sm text-blue-600"
              >
                ลองโหลดข้อมูลอีกครั้ง
              </button>
              <button
                onClick={() => signOut(auth)}
                className="w-full text-sm text-slate-500"
              >
                ออกจากระบบ
              </button>
            </div>
          )}
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={15} /> ใช้บัญชี Google ของคุณเพื่อยืนยันตัวตน
          </p>
        </section>
      </main>
    );

  if (profile.status === "clearing" || profile.status === "cleared")
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="mx-auto mb-4 text-slate-500" size={32} />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            บัญชีนี้ปิดการใช้งานแล้ว
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            ข้อมูลในระบบถูกล้างโดยผู้ดูแล หากต้องการกลับมาใช้งาน
            กรุณาติดต่อผู้ดูแลระบบ
          </p>
          <button
            onClick={() => signOut(auth)}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white"
          >
            ออกจากระบบ
          </button>
        </section>
      </main>
    );

  const trialEnd = (profile.createdAt?.toMillis() ?? NaN) + 9 * DAY;
  const paidEnd = profile.paidUntil?.toMillis() || 0;
  const plan = profile.plan || (profile.paidUntil ? "paid" : "trial");
  const trialActive =
    plan === "trial" && Number.isFinite(trialEnd) && now < trialEnd;
  const paidActive = plan === "paid" && paidEnd > now;
  const lifetimeActive = plan === "lifetime";
  const access =
    trialActive ||
    paidActive ||
    lifetimeActive ||
    profile.role === "supperAdmin";
  const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / DAY));
  const accessState = lifetimeActive
    ? "lifetime"
    : paidActive
      ? "paid"
      : trialActive
        ? "trial"
        : "expired";
  const accessLabel =
    accessState === "lifetime"
      ? "แพ็กเกจฟรีตลอดชีพ"
      : accessState === "paid"
        ? `แพ็กเกจชำระเงิน · ถึง ${new Date(paidEnd).toLocaleDateString("th-TH")}`
        : accessState === "trial"
          ? `แพ็กเกจทดลองใช้ · เหลือ ${daysLeft} วัน`
          : plan === "paid"
            ? "แพ็กเกจชำระเงินหมดอายุ"
            : "แพ็กเกจทดลองใช้หมดอายุ";
  const complete = hasRegistration(profile);
  const latestPayment = payments[0];

  if (!complete)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <form
          onSubmit={saveProfile}
          className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-9"
        >
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950">
            <GraduationCap />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            ข้อมูลสำหรับเริ่มใช้งาน
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            กรอกข้อมูลส่วนตัวและโรงเรียนเพียงครั้งแรก
          </p>
          <p className="mt-2 text-xs text-slate-500">
            หากเคยลงทะเบียนแล้ว โปรดตรวจว่ากำลังใช้บัญชี Google เดิม
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium dark:text-slate-200">
              ชื่อ–นามสกุล
              <input
                required
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
                className={`mt-1.5 ${field}`}
              />
            </label>
            <label className="text-sm font-medium dark:text-slate-200">
              ตำแหน่ง
              <input
                required
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className={`mt-1.5 ${field}`}
              />
            </label>
            <label className="text-sm font-medium dark:text-slate-200 sm:col-span-2">
              ชื่อโรงเรียน
              <input
                required
                value={form.schoolName}
                onChange={(e) =>
                  setForm({ ...form, schoolName: e.target.value })
                }
                className={`mt-1.5 ${field}`}
              />
            </label>
            <label className="text-sm font-medium dark:text-slate-200 sm:col-span-2">
              เบอร์โทรศัพท์ (ไม่บังคับ)
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`mt-1.5 ${field}`}
              />
            </label>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            บัญชีที่เข้าสู่ระบบ: {user?.email || profile.email} · UID:{" "}
            {user?.uid}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-600">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            บันทึกและเริ่มใช้งาน
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="mt-3 w-full text-sm text-slate-500"
          >
            ออกจากระบบ
          </button>
        </form>
      </main>
    );

  if (profile.role !== "supperAdmin" && legalAccepted !== true)
    return (
      <main className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <header className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
          <div className="flex w-full items-center justify-between gap-4">
            <img src="/haiteacher-brand.png" alt="ThaiTeacher" className="h-12 w-auto max-w-40 object-contain" />
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">ขั้นตอน {legalStep} จาก 2</span>
          </div>
        </header>
        <div className="w-full flex-1 px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
          {legalAccepted === null ? <div className="text-sm text-slate-500">{legalError ? <><p role="alert" className="text-rose-600">{legalError}</p><button type="button" onClick={retryLegal} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">ลองใหม่</button></> : "กำลังตรวจสอบข้อมูล..."}</div> : <>
            <div className="mb-5"><p className="text-xs font-semibold text-blue-600 dark:text-blue-300">ก่อนเริ่มใช้งาน ThaiTeacher</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{legalStep === 1 ? "ข้อตกลงการให้บริการ" : "ประกาศความเป็นส่วนตัว"}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{legalStep === 1 ? "โปรดอ่านเงื่อนไขการใช้งานก่อนดำเนินการต่อ" : "โปรดอ่านวิธีที่ระบบใช้และเก็บรักษาข้อมูลของคุณ"}</p></div>
            <article className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {legalStep === 1 ? <><p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-slate-200 md:col-span-2 xl:col-span-3">{termsIntroduction}</p>{termsSections.map(({ title, body }) => <section key={title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p></section>)}</> : privacySections.map(({ title, body }) => <section key={title} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p></section>)}
            </article>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 dark:border-blue-900 dark:bg-blue-950/40"><input type="checkbox" checked={legalStep === 1 ? acceptTermsChecked : privacyChecked} onChange={event => legalStep === 1 ? setAcceptTermsChecked(event.target.checked) : setPrivacyChecked(event.target.checked)} className="mt-1 size-5 shrink-0 accent-blue-600" /><span>{legalStep === 1 ? "ฉันได้อ่านและยอมรับข้อตกลงการให้บริการฉบับนี้" : "ฉันได้อ่านและรับทราบประกาศความเป็นส่วนตัวฉบับนี้"}</span></label>
            {legalError && <p role="alert" className="mt-3 text-sm text-rose-600">{legalError}</p>}
          </>}
        </div>
        {legalAccepted === false && <footer className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-7 lg:px-10"><div className="flex w-full items-center justify-between gap-3"><button type="button" onClick={() => legalStep === 2 ? (setLegalStep(1), window.scrollTo(0, 0)) : void signOut(auth)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold dark:border-slate-700">{legalStep === 2 ? "ย้อนกลับ" : "ออกจากระบบ"}</button><button type="button" onClick={() => legalStep === 1 ? (setLegalStep(2), window.scrollTo(0, 0)) : void confirmLegal()} disabled={legalStep === 1 ? !acceptTermsChecked : !privacyChecked || busy} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{legalStep === 1 ? "ถัดไป" : busy ? "กำลังบันทึก..." : "ยอมรับและเริ่มใช้งาน"}</button></div></footer>}
      </main>
    );

  if (showDemo && profile.role !== "supperAdmin")
    return <DemoApp accountKey={user.uid} user={user} completedTours={profile.tourCompleted} onLogin={() => {
      localStorage.setItem(`thaiteacher-demo-seen:${user.uid}`, "1");
      setStorageUser(user.uid, profile.dataVersion || 0);
      configureStorageSync((uid, key, data) =>
        key === "school-finances-v2" || key.startsWith("school-finances-conflict-backup:")
          ? Promise.resolve()
          : writeAppState(user, key, data, uid === user.uid ? undefined : uid),
      );
      setShowDemo(false);
    }} />;

  if (!access)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-9">
          {missingAdminClaim && (
            <p
              role="alert"
              className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              พบ role ผู้ดูแลใน Firestore แต่ Firebase ID token ยังไม่มี custom
              claim supperAdmin จึงยังไม่สามารถเปิด Dashboard ผู้ดูแลได้
            </p>
          )}
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Clock3 />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {accessLabel}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            ข้อมูลของคุณยังอยู่ในระบบ สามารถต่ออายุเพื่อใช้งานต่อได้
          </p>
          <div className="mt-6 rounded-2xl bg-blue-50 p-5 dark:bg-blue-950/50">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              ชำระค่าบริการ
            </h2>
            {paymentAmount > 0 && paymentQrUrl ? (
              <>
                <p className="mt-2 text-sm">
                  ยอดชำระ{" "}
                  <strong className="text-xl text-blue-700 dark:text-blue-300">
                    ฿{paymentAmount.toLocaleString("th-TH")}
                  </strong>
                </p>
                <img
                  src={paymentQrUrl}
                  alt="QR สำหรับชำระค่าบริการ"
                  className="mx-auto mt-5 max-h-72 rounded-xl bg-white p-3"
                />
                <p className="mt-3 text-center text-xs text-slate-500">
                  ตรวจสอบชื่อบัญชีปลายทางในแอปธนาคารก่อนโอนเงิน
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                กำลังเตรียมราคาและ QR รับชำระเงิน กรุณาติดต่อผู้ดูแลระบบ
              </p>
            )}
          </div>
          {latestPayment?.status === "pending" && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Clock3 size={18} /> ส่งสลิปแล้ว กำลังรอตรวจสอบ
            </p>
          )}
          {latestPayment?.status === "rejected" && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              สลิปก่อนหน้าไม่ผ่านการตรวจสอบ กรุณาส่งใหม่
            </p>
          )}
          {paymentAmount > 0 &&
            paymentQrUrl &&
            latestPayment?.status !== "pending" && (
              <div className="mt-5">
                <label className="block text-sm font-semibold text-slate-800 dark:text-white">
                  แนบสลิปการโอนเงิน
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => setSlip(e.target.files?.[0] || null)}
                    className={`mt-2 ${field}`}
                  />
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  รองรับ JPG, PNG, WebP และ PDF ไม่เกิน 10 MB
                  การต่ออายุจะเริ่มหลังผู้ดูแลตรวจสอบสลิป
                </p>
                <button
                  onClick={submitSlip}
                  disabled={!slip || busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  <UploadCloud size={18} /> ส่งสลิปให้ตรวจสอบ
                </button>
              </div>
            )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-rose-600">
              {error}
            </p>
          )}
          <button
            onClick={() => signOut(auth)}
            className="mt-6 flex items-center gap-2 text-sm text-slate-500"
          >
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </section>
      </main>
    );

  return (
    <>
      {missingAdminClaim && (
        <div
          role="alert"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          บัญชีนี้มีข้อมูลบทบาทผู้ดูแลใน Firestore แต่ Firebase ID token
          ยังไม่มีสิทธิ์ supperAdmin กรุณาตั้ง custom claim ใน Firebase
          Authentication แล้วออกจากระบบและเข้าใหม่
        </div>
      )}
      {children(
        profile,
        accessLabel,
        accessState,
        () => {
          void signOut(auth);
        },
        user,
        (value) => setProfile(toProfile(value)),
      )}
    </>
  );
}

