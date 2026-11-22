import { signInWithGoogle } from "./signInWithGoogle";
import { clearApiReadCache } from "../../shared/funtion/apiRequestCache";
import BrandLogo from "../../shared/components/BrandLogo";
import { BillingPriceContext, FinanceReadOnlyContext } from "../../shared/FinanceAccess";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDocFromServer, onSnapshot, type Timestamp } from "firebase/firestore";
import SchoolRemovalPopup from "./SchoolRemovalPopup";
import {
  ArrowRight,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { auth, db } from "../../config/firebase";
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
  acceptLegal,
  getLegalAcceptance,
  getProfile,
  recordVisit,
  updateProfile,
  type UserProfile,
} from "../../config/services/users.service";
import { legalVersion, privacySections, termsIntroduction, termsSections } from "../../shared/legalContent";
import DemoApp from "./DemoApp";
import PaymentPage from "../../modules/payments/PaymentPage";

type Profile = Omit<UserProfile, "createdAt" | "paidUntil"> & {
  createdAt: Timestamp | null;
  paidUntil?: Timestamp | null;
};
const hasWriteAccess = (value: UserProfile) => typeof value.accessGranted === "boolean" ? value.accessGranted : value.role === "supperAdmin" || value.plan === "lifetime" || (value.plan === "paid" && Date.parse(value.paidUntil || "") > Date.now()) || (value.plan === "trial" && Date.parse(value.createdAt || "") + (value.trialDays || 9) * DAY > Date.now());
const visitSessionIds = new Map<string, string>();
const toProfile = (value: UserProfile): Profile => ({
  ...value,
  createdAt: value.createdAt
    ? ({ toMillis: () => new Date(value.createdAt!).getTime() } as Timestamp)
    : null,
  paidUntil: (value.accessPaidUntil || value.paidUntil)
    ? ({ toMillis: () => new Date((value.accessPaidUntil || value.paidUntil)!).getTime() } as Timestamp)
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

async function loadProfile(user: User, fresh = false): Promise<UserProfile> {
  const apiProfile = await getProfile(user, fresh);
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
    profile.schoolRemovalId || hasRegistration(profile) ||
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

async function syncOwnerState(user: User, version: number, readOnly = false, active = () => true) {
  const remote = await loadAppState(user);
  if (!active()) return;
  if (readOnly) {
    replaceScopedSnapshot(user.uid, version, remote);
    return;
  }
  const local = readScopedSnapshot(user.uid, version);
  const merged = { ...remote };
  for (const [key, value] of Object.entries(local)) {
    if (!active()) return;
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
  if (active()) replaceScopedSnapshot(user.uid, version, merged);
}

const DAY = 24 * 60 * 60 * 1000;
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
  const [removal, setRemoval] = useState<{ id: string; school: string } | null>(null);
  const removalRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missingAdminClaim, setMissingAdminClaim] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);
  const [legalError, setLegalError] = useState("");
  const [acceptTermsChecked, setAcceptTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [legalStep, setLegalStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    position: "",
    schoolName: "",
  });
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
      removalRef.current = false;
      setRemoval(null);
      setError("");
      setMissingAdminClaim(false);
      setLegalAccepted(null);
      setLegalError("");
      setLegalStep(1);
      if (!current) {
        clearApiReadCache();
        visitSessionIds.clear();
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
        if (removalRef.current) { setLoading(false); return; }
        if (value.schoolRemovalId || value.status === "clearing" || value.status === "cleared")
          clearStorageForUser(current.uid);
        else {
          setStorageUser(current.uid, value.dataVersion || 0);
          const canWrite = hasWriteAccess(value);
          configureStorageSync(!canWrite ? null : (uid, key, data) =>
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
            await syncOwnerState(current, value.dataVersion || 0, !canWrite, () => !removalRef.current);
            if (requestId !== authRequestId) return;
          } catch (syncError) {
            console.error("Failed to sync owner state", syncError);
          }
        }
        setProfile(toProfile(value));
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
    let active = true;
    const target = doc(db, "users", user.uid);
    const check = (data: Record<string, unknown> | undefined) => {
      if (!active || typeof data?.schoolRemovalId !== "string" || !data.schoolRemovalId) return;
      removalRef.current = true;
      configureStorageSync(null);
      setViewingUser(null);
      clearStorageForUser(user.uid);
      clearApiReadCache();
      setRemoval({ id: data.schoolRemovalId, school: typeof data.schoolRemovedFrom === "string" ? data.schoolRemovedFrom : "" });
    };
    const unsubscribe = onSnapshot(target, snapshot => check(snapshot.data()), () => {
      // A focus check below also retries after a temporary listener failure.
    });
    const focus = () => {
      if (document.visibilityState === "visible") void getDocFromServer(target).then(snapshot => check(snapshot.data())).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", focus);
    return () => { active = false; unsubscribe(); document.removeEventListener("visibilitychange", focus); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const refreshInterval = 10 * 60_000;
    let lastRefreshAt = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefreshAt < refreshInterval) return;
      lastRefreshAt = Date.now();
      void loadProfile(user)
        .then(async (value) => {
          if (removalRef.current || value.schoolRemovalId) return;
          if (value.status === "clearing" || value.status === "cleared")
            clearStorageForUser(user.uid);
          else {
            setStorageUser(user.uid, value.dataVersion || 0);
            await syncOwnerState(user, value.dataVersion || 0, !hasWriteAccess(value), () => !removalRef.current);
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
      await signInWithGoogle();
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
        schoolName: profile?.schoolId && profile.schoolId !== user.uid
          ? profile.schoolName : form.schoolName.trim(),
      });
      setProfile(toProfile(value));
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  };
  if (user && removal) return <SchoolRemovalPopup key={removal.id} user={user} id={removal.id} school={removal.school} />;
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
          <BrandLogo className="mx-auto mb-5 w-48 object-contain" />
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

  const trialEnd = (profile.createdAt?.toMillis() ?? NaN) + (profile.trialDays || 9) * DAY;
  const paidEnd = profile.paidUntil?.toMillis() || 0;
  const plan = profile.plan || (profile.paidUntil ? "paid" : "trial");
  const trialActive =
    plan === "trial" && Number.isFinite(trialEnd) && now < trialEnd;
  const paidActive = plan === "paid" && paidEnd > now;
  const lifetimeActive = plan === "lifetime";
  const access = typeof profile.accessGranted === "boolean" ? profile.accessGranted || profile.role === "supperAdmin" :
    trialActive ||
    paidActive ||
    lifetimeActive ||
    profile.role === "supperAdmin";
  const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / DAY));
  const accessState = profile.accessPlan || (lifetimeActive
    ? "lifetime"
    : paidActive
      ? "paid"
      : trialActive
        ? "trial"
        : "expired");
  const accessLabel = profile.billingMode === "sponsored" ? (access ? "ใช้สิทธิ์แพ็กเกจของบัญชีหลัก" : "บัญชีหลักยังไม่มีแพ็กเกจที่ใช้งานได้") : profile.billingMode === "individual" && !access ? "แพ็กเกจจ่ายเองยังไม่พร้อมใช้งาน กรุณาชำระหรือต่ออายุ" :
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
            {profile.schoolId && profile.schoolId !== user?.uid
              ? "กรอกข้อมูลส่วนตัว โรงเรียนกำหนดตามคำเชิญที่คุณรับแล้ว"
              : "กรอกข้อมูลส่วนตัวและโรงเรียนเพียงครั้งแรก"}
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
                value={profile.schoolId && profile.schoolId !== user?.uid ? profile.schoolName : form.schoolName}
                readOnly={Boolean(profile.schoolId && profile.schoolId !== user?.uid)}
                aria-describedby={profile.schoolId && profile.schoolId !== user?.uid ? "invited-school-note" : undefined}
                onChange={(e) =>
                  setForm({ ...form, schoolName: e.target.value })
                }
                className={`mt-1.5 ${field} ${profile.schoolId && profile.schoolId !== user?.uid ? "cursor-default !bg-slate-100 !text-slate-500 dark:!bg-slate-800 dark:!text-slate-400" : ""}`}
              />
              {profile.schoolId && profile.schoolId !== user?.uid && (
                <span id="invited-school-note" className="mt-2 block text-xs font-normal text-slate-500 dark:text-slate-400">
                  โรงเรียนจากคำเชิญ · ดูได้อย่างเดียว สมาชิกไม่สามารถเปลี่ยนชื่อหรือย้ายโรงเรียนเองได้
                </span>
              )}
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
            <BrandLogo className="h-12 w-auto max-w-40 object-contain" />
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

  if (location.pathname === "/billing")
    return <div className={localStorage.getItem("thaiteacher-theme") === "dark" ? "dark" : ""}>
      <PaymentPage
        key={user.uid}
        user={user}
        profile={{ displayName: profile.displayName, email: profile.email, schoolName: profile.schoolName }}
        accessLabel={accessLabel}
        accessState={accessState}
        onBack={() => navigate(profile.role === "supperAdmin" ? "/admin/dashboard" : "/finance/school-finance")}
        onSignOut={() => { void signOut(auth); }}
        onRefreshAccess={async () => { const updated = await loadProfile(user, true); setProfile(toProfile(updated)); }}
      />
    </div>;
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
      <BillingPriceContext.Provider value={profile.billingMode === "sponsored" ? 0 : ((profile.monthlyPriceSatang || 9900) / (profile.billingMode === "individual" ? 10 : 1)) / 100}>
      <FinanceReadOnlyContext.Provider value={!access && profile.role !== "supperAdmin"}>
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
      </FinanceReadOnlyContext.Provider>
      </BillingPriceContext.Provider>
    </>
  );
}

