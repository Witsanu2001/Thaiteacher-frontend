import {
  getProfile,
  type UserProfile,
} from "../../config/services/users.service";
import SchoolInvitationShare from "./SchoolInvitationShare";
import { useEffect, useId, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  setSchoolPaymentMode,
  createSchoolInvitation,
  getSchoolTeam,
  revokeSchoolInvitation,
  removeSchoolMember,
  schoolTeamError,
  type SchoolTeam,
} from "../../config/services/school-team.service";

export default function SchoolTeamPanel({
  user,
  onProfileSaved,
}: {
  user: User;
  onProfileSaved?: (profile: UserProfile) => void;
}) {
  const [team, setTeam] = useState<SchoolTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteMode, setInviteMode] = useState<"sponsored" | "individual" | "">(
    "",
  );
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<{
    token: string;
    email: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const actionLock = useRef(false);
  useEffect(() => {
    let active = true;
    void getSchoolTeam(user)
      .then((value) => {
        if (active) setTeam(value);
      })
      .catch((err) => {
        if (active) setError(schoolTeamError(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function run(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(schoolTeamError(err));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const selectedMode =
    team?.schoolPaymentMode === "owner_pays"
      ? "sponsored"
      : team?.schoolPaymentMode === "split"
        ? "individual"
        : inviteMode;
  const policyReady = team?.invitationPolicyVersion === 2;
  const sharePrice =
    Number.isSafeInteger(team?.monthlyPriceSatang) &&
    (team?.monthlyPriceSatang || 0) > 0
      ? (team!.monthlyPriceSatang / 1000).toLocaleString("th-TH", {
          minimumFractionDigits: 2,
        })
      : null;
  const fullPrice = sharePrice
    ? (team!.monthlyPriceSatang / 100).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
      })
    : null;
  const emailInputId = useId();
  const input =
    "w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
  const button =
    "min-h-11 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700";
  return (
    <section className="space-y-5 rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div>
        <h2 className="text-xl font-bold">สมาชิกโรงเรียน</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          บัญชีหลัก 1 บัญชี และสมาชิกสูงสุด 9 บัญชี ใช้ข้อมูลโรงเรียนร่วมกัน
        </p>
      </div>
      {loading && <p role="status">กำลังโหลดสมาชิก…</p>}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}
      {team && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{team.schoolName}</p>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {team.members.length} / {team.limit} บัญชี ·{" "}
              {team.isOwner ? "คุณเป็นบัญชีหลัก" : "คุณเป็นสมาชิก"}
            </span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {team.members.map((member) => (
              <li
                key={member.uid}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {member.displayName || "สมาชิกโรงเรียน"}
                  </p>
                  {member.email && (
                    <p className="break-all text-sm text-slate-500 dark:text-slate-400">
                      {member.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {member.owner ? "บัญชีหลัก" : "สมาชิก"}
                  </span>
                  {team.isOwner && !member.owner && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRemoving(member.uid)}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300"
                    >
                      คัดออก
                    </button>
                  )}
                </div>
                {team.isOwner && !member.owner && removing === member.uid && (
                  <div
                    role="alert"
                    className="w-full space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900 dark:bg-rose-950/30"
                  >
                    <p className="font-semibold">
                      ถอด {member.displayName || member.email || "สมาชิกคนนี้"}{" "}
                      ออกจากโรงเรียน?
                    </p>
                    <p className="leading-6 text-slate-600 dark:text-slate-300">
                      สมาชิกจะเข้าถึงข้อมูลโรงเรียนนี้และใช้สิทธิ์ร่วมกับบัญชีหลักไม่ได้อีก
                      บัญชีของสมาชิกและข้อมูลการเงินโรงเรียนจะไม่ถูกลบ
                      หากต้องการกลับเข้าทีมต้องรับคำเชิญใหม่
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await removeSchoolMember(user, member.uid);
                            setTeam((current) =>
                              current
                                ? {
                                    ...current,
                                    members: current.members.filter(
                                      (item) => item.uid !== member.uid,
                                    ),
                                  }
                                : current,
                            );
                            setRemoving(null);
                            setNotice(
                              "ถอดสมาชิกออกจากทีมแล้ว",
                            );
                          })
                        }
                        className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                      >
                        {busy ? "กำลังถอดสมาชิก…" : "ยืนยันถอดสมาชิก"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setRemoving(null)}
                        className="rounded-lg border border-slate-200 px-4 py-2 dark:border-slate-700"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {team.schoolPaymentMode && (
            <div className="space-y-2 rounded-xl border border-blue-100 p-4 dark:border-blue-900">
              <h3 className="font-semibold">รูปแบบชำระเงินของโรงเรียน</h3>
              <p>
                {team.schoolPaymentMode === "owner_pays"
                  ? "บัญชีหลักจ่ายเต็ม สมาชิกใช้สิทธิ์ร่วมกัน"
                  : "หารกัน 10 ส่วน รวมบัญชีหลักด้วย แต่ละบัญชีชำระส่วนของตัวเอง"}
              </p>
            </div>
          )}
          {team.isOwner && (
            <>
              {!policyReady && (
                <p
                  role="alert"
                  className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  ระบบส่วนสมาชิกยังไม่รองรับการกำหนดรูปแบบชำระเงิน
                  กรุณาอัปเดตหลังบ้านก่อนสร้างคำเชิญ
                </p>
              )}
              {!team.schoolPaymentMode && (
                <fieldset disabled={busy || !policyReady} className="space-y-3">
                  <legend className="mb-2 font-semibold">
                    เลือกรูปแบบชำระเงินโรงเรียน (เลือกครั้งเดียว)
                  </legend>
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <input
                      type="radio"
                      name="school-payment-mode"
                      className="mt-1 accent-blue-600"
                      checked={inviteMode === "sponsored"}
                      onChange={() => setInviteMode("sponsored")}
                    />
                    <span>
                      <strong>
                        บัญชีหลักจ่ายเต็ม
                        {fullPrice ? ` ${fullPrice} บาท/เดือน` : ""}
                      </strong>
                      <small className="mt-1 block">
                        บัญชีหลักชำระราคาแพ็กเกจเต็ม ครอบคลุมสูงสุด 10 บัญชี
                        สมาชิกที่เชิญไม่ต้องจ่ายเอง
                      </small>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <input
                      type="radio"
                      name="school-payment-mode"
                      className="mt-1 accent-blue-600"
                      checked={inviteMode === "individual"}
                      onChange={() => setInviteMode("individual")}
                    />
                    <span>
                      <strong>หารกัน 10 ส่วน รวมบัญชีหลัก</strong>
                      <small className="mt-1 block">
                        แต่ละบัญชีชำระราคาประจำบัญชีของตัวเองหาร 10 คงที่
                        แม้สมาชิกไม่ครบ
                        {sharePrice
                          ? ` · ส่วนของบัญชีหลัก ${sharePrice} บาท/เดือน`
                          : ""}{" "}
                        บัญชีที่ยังไม่ชำระจะดูข้อมูลได้ แต่แก้ไขไม่ได้
                      </small>
                    </span>
                  </label>
                  <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                    รูปแบบนี้จะถูกบันทึกเมื่อกดยืนยัน และเลือกได้เพียงครั้งเดียว
                    และใช้กับคำเชิญถัดไปทั้งโรงเรียน
                    ไม่คืนเงินหรือเปลี่ยนวันหมดอายุที่เคยชำระไว้
                    หากมีรายการชำระเดิมรอตรวจ กรุณาจัดการก่อนเลือกรูปแบบหารกัน
                  </p>
                  <button
                    type="button"
                    className={button}
                    disabled={busy || !inviteMode || !policyReady}
                    onClick={() => {
                      void run(async () => {
                        if (!inviteMode) return;
                        await setSchoolPaymentMode(user, inviteMode);
                        setTeam(await getSchoolTeam(user));
                        if (onProfileSaved)
                          onProfileSaved(await getProfile(user, true));
                        setNotice("บันทึกรูปแบบแล้ว ใช้รูปแบบนี้กับทุกคำเชิญ");
                      });
                    }}
                  >
                    ยืนยันรูปแบบชำระเงิน
                  </button>
                </fieldset>
              )}
              <form
                className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    if (
                      !selectedMode ||
                      !policyReady ||
                      !team.schoolPaymentMode
                    )
                      return;
                    const result = await createSchoolInvitation(
                      user,
                      email.trim(),
                      selectedMode,
                    );
                    setCreated({
                      token: result.token,
                      email: result.invitation.email,
                      expiresAt: result.invitation.expiresAt,
                    });
                    setEmail("");
                    setTeam(await getSchoolTeam(user));
                    if (onProfileSaved)
                      onProfileSaved(await getProfile(user, true));
                  });
                }}
              >
                <div className="space-y-3">
                  <label htmlFor={emailInputId} className="block font-semibold">
                    เชิญสมาชิกด้วยอีเมล Google
                  </label>
                  <div className="flex items-stretch gap-2">
                    <input
                      id={emailInputId}
                      className={`${input} flex-1`}
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="off"
                      placeholder="teacher@gmail.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={
                        busy ||
                        team.members.length + team.invitations.length >=
                          team.limit
                      }
                    />

                    <button
                      type="submit"
                      className={`${button} shrink-0 whitespace-nowrap`}
                      disabled={
                        busy ||
                        !team.schoolPaymentMode ||
                        !selectedMode ||
                        !policyReady ||
                        team.members.length + team.invitations.length >=
                          team.limit
                      }
                    >
                      {busy ? "กำลังทำรายการ…" : "สร้างคำเชิญ"}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ส่งลิงก์หรือ QR ให้เจ้าของอีเมลนี้โดยตรง
                  คำเชิญใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง
                  และต้องเข้าสู่ระบบด้วยอีเมลที่เชิญ ระบบไม่ได้ส่งอีเมลอัตโนมัติ
                </p>
              </form>
              {created && (
                <SchoolInvitationShare key={created.token} {...created} />
              )}
              {team.invitations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">คำเชิญที่ยังไม่หมดอายุ</h3>
                  {team.invitations.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="break-all text-sm">{invite.email}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          หมดอายุ{" "}
                          {new Date(invite.expiresAt).toLocaleString("th-TH")}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 rounded-lg px-3 text-sm text-rose-600 disabled:opacity-40 dark:text-rose-300"
                        onClick={() => {
                          void run(async () => {
                            await revokeSchoolInvitation(user, invite.id);
                            setCreated(null);
                            setTeam(await getSchoolTeam(user));
                            setNotice("ยกเลิกคำเชิญแล้ว");
                          });
                        }}
                      >
                        ยกเลิกคำเชิญ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
