import type { UserProfile } from "../../config/services/users.service";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "firebase/auth";
import axios from "axios";
import {
  Check,
  CheckCircle2,
  CreditCard,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  getAdminPayments,
  getAdminPaymentSlip,
  reviewPayment,
  type AdminPayment,
} from "../../config/services/payments.service";
const statusText = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};
const statusClass = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
  approved:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};
const input =
  "min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800";
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      })
    : "—";
const money = (value: number) =>
  value.toLocaleString("th-TH", { minimumFractionDigits: 2 });
export default function AdminPaymentsPanel({
  user,
  onUserUpdated,
}: {
  user: User;
  onUserUpdated: (profile: UserProfile) => void;
}) {
  const [items, setItems] = useState<AdminPayment[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("pending"),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminPayment | null>(null),
    [slip, setSlip] = useState<{ url: string; type: string } | null>(null),
    [slipLoading, setSlipLoading] = useState(false),
    [slipError, setSlipError] = useState(""),
    [decision, setDecision] = useState<"approved" | "rejected" | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewError, setReviewError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getAdminPayments(user, true));
    } catch {
      setError("โหลดรายการชำระเงินไม่สำเร็จ กรุณาตรวจสิทธิ์หรือกดรีเฟรชอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    let active = true;
    void getAdminPayments(user)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setError("โหลดรายการชำระเงินไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  useEffect(() => {
    if (!selected) return;
    let active = true,
      url = "";
    void getAdminPaymentSlip(user, selected)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setSlip({ url, type: blob.type });
      })
      .catch(() => {
        if (active)
          setSlipError("เปิดสลิปไม่สำเร็จ กรุณาตรวจไฟล์และสิทธิ์ Storage ก่อนอนุมัติ");
      })
      .finally(() => {
        if (active) setSlipLoading(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected, user]);
  const open = (payment: AdminPayment) => {
    setSelected(payment);
    setSlip(null);
    setSlipLoading(true);
    setSlipError("");
    setDecision(null);
    setReason("");
    setReviewError("");
  };
  const confirm = async () => {
    if (
      !selected ||
      !decision ||
      lock.current ||
      (!slip && decision === "approved")
    )
      return;
    if (decision === "rejected" && !reason.trim()) {
      setReviewError("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
      return;
    }
    lock.current = true;
    setBusy(true);
    setReviewError("");
    try {
      const result = await reviewPayment(
        user,
        selected,
        decision,
        reason.trim(),
      );
      setItems((current) =>
        current.map((item) =>
          item.uid === selected.uid && item.id === selected.id
            ? { ...item, ...result.payment }
            : item,
        ),
      );
      onUserUpdated(result.profile);
      setMessage(
        decision === "approved"
          ? `อนุมัติแล้ว · ${selected.displayName || selected.email} ใช้งานถึง ${date(result.payment.activatedUntil || result.profile.paidUntil || undefined)}`
          : "ไม่อนุมัติรายการแล้ว ลูกค้าสามารถส่งสลิปใหม่ได้",
      );
      setSelected(null);
    } catch (cause) {
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        setReviewError("รายการนี้ถูกตรวจสอบแล้วจากอีกหน้าจอ กรุณาปิดหน้าต่างและรีเฟรช");
        void refresh();
      } else
        setReviewError(
          "บันทึกไม่สำเร็จ กรุณาลองใหม่ ระบบจะไม่ต่ออายุซ้ำหากรายการนี้ได้รับอนุมัติแล้ว",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const rows = items.filter(
    (item) =>
      (filter === "all" || item.status === filter) &&
      `${item.displayName} ${item.email} ${item.schoolName}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950">
            <CreditCard size={22} />
          </span>
          <div>
            <h2 className="font-bold">ตรวจสอบการชำระเงิน</h2>
            <p className="mt-1 text-sm text-slate-500">
              รอตรวจสอบ{" "}
              {items.filter((item) => item.status === "pending").length} รายการ
              · 99 บาท / 1 เดือน
            </p>
          </div>
        </div>
        <button
          aria-label="รีเฟรชรายการชำระเงิน"
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh()}
          className="rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อ อีเมล หรือโรงเรียน"
            aria-label="ค้นหาการชำระเงิน"
            className={`${input} w-full pl-10`}
          />
        </div>
        <select
          aria-label="สถานะการชำระเงิน"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className={input}
        >
          <option value="pending">รอตรวจสอบ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ไม่อนุมัติ</option>
          <option value="all">ทุกสถานะ</option>
        </select>
      </div>
      {message && (
        <p
          role="status"
          className="mx-5 mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {message}
        </p>
      )}
      {error ? (
        <p role="alert" className="p-5 text-sm text-rose-600">
          {error}
        </p>
      ) : loading ? (
        <div
          role="status"
          aria-label="กำลังโหลดการชำระเงิน"
          className="grid min-h-32 place-items-center"
        >
          <Loader2 className="animate-spin text-blue-600" />
        </div>
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800">
              <tr>
                {[
                  "ผู้ใช้งาน / โรงเรียน",
                  "วันที่ส่ง",
                  "ยอดโอน",
                  "สถานะ",
                  "ตรวจสอบ",
                ].map((text) => (
                  <th key={text} className="px-5 py-3 font-medium">
                    {text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((item) => (
                <tr key={`${item.uid}:${item.id}`}>
                  <td className="px-5 py-4">
                    <p className="font-semibold">
                      {item.displayName || item.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.schoolName}
                      <br />
                      {item.email}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {date(item.submittedAt)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums">
                    {money(item.amount)} บาท
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[item.status]}`}
                    >
                      {statusText[item.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 px-3 py-2 font-semibold text-blue-600 dark:border-blue-900 dark:text-blue-300"
                    >
                      <Eye size={16} />
                      ดูสลิป
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-10 text-center text-sm text-slate-400">
          ไม่มีรายการชำระเงินในสถานะนี้
        </p>
      )}
      {selected &&
        createPortal(
          <div
            className={`${localStorage.getItem("thaiteacher-theme") === "dark" ? "dark " : ""}fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6`}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-review-title"
              className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl dark:bg-slate-900 dark:text-slate-100"
            >
              <header className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800 sm:px-6">
                <h2 id="payment-review-title" className="font-bold">
                  ตรวจสอบสลิปและแพ็กเกจ
                </h2>
                <button
                  aria-label="ปิดการตรวจสอบ"
                  disabled={busy}
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-2"
                >
                  <X size={20} />
                </button>
              </header>
              <div className="grid min-h-0 gap-5 overflow-y-auto p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid min-h-64 place-items-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                  {slipLoading ? (
                    <Loader2 className="animate-spin text-blue-600" />
                  ) : slipError ? (
                    <p role="alert" className="p-5 text-sm text-rose-600">
                      {slipError}
                    </p>
                  ) : slip?.type === "application/pdf" ? (
                    <iframe
                      src={slip.url}
                      title="สลิป PDF"
                      className="h-[55dvh] min-h-80 w-full"
                    />
                  ) : slip ? (
                    <img
                      src={slip.url}
                      alt="สลิปที่ผู้ใช้งานแนบ"
                      className="max-h-[65dvh] w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">
                      {selected.displayName || selected.email}
                    </h3>
                    <p className="break-words text-sm text-slate-500">
                      {selected.email}
                      <br />
                      {selected.schoolName}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40">
                    <p className="text-sm text-slate-500">ยอดแจ้งชำระ</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-300">
                      {money(selected.amount)} บาท
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      ส่งเมื่อ {date(selected.submittedAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[selected.status]}`}
                  >
                    {statusText[selected.status]}
                  </span>
                  {selected.reviewedAt && (
                    <p className="text-sm text-slate-500">
                      ตรวจเมื่อ {date(selected.reviewedAt)}
                      {selected.activatedUntil && (
                        <>
                          <br />
                          ใช้งานถึง {date(selected.activatedUntil)}
                        </>
                      )}
                      {selected.reviewNote && (
                        <>
                          <br />
                          หมายเหตุ: {selected.reviewNote}
                        </>
                      )}
                    </p>
                  )}
                  {selected.status === "pending" && (
                    <>
                      <p className="text-sm leading-6 text-slate-500">
                        ตรวจยอด 99 บาทและการรับเงินจริงก่อนอนุมัติ ระบบต่ออายุ 1
                        เดือนจากวันหมดอายุเดิม หรือวันอนุมัติหากหมดสิทธิ์แล้ว
                      </p>
                      {!decision ? (
                        <div className="grid gap-2">
                          <button
                            type="button"
                            disabled={
                              slipLoading || !slip || selected.amount !== 99
                            }
                            onClick={() => setDecision("approved")}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"
                          >
                            <CheckCircle2 size={18} />
                            อนุมัติ 1 เดือน
                          </button>
                          <button
                            type="button"
                            onClick={() => setDecision("rejected")}
                            className="rounded-xl border border-rose-200 px-4 py-3 font-semibold text-rose-600 dark:border-rose-900"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-blue-200 p-4 dark:border-blue-900">
                          <p className="font-semibold">
                            {decision === "approved"
                              ? "ยืนยันอนุมัติและต่ออายุ 1 เดือน?"
                              : "ระบุเหตุผลที่ไม่อนุมัติ"}
                          </p>
                          <label className="grid gap-1.5 text-sm">
                            หมายเหตุ{" "}
                            {decision === "approved" ? "(ไม่บังคับ)" : "(จำเป็น)"}
                            <textarea
                              aria-label="หมายเหตุการตรวจสอบ"
                              value={reason}
                              disabled={busy}
                              maxLength={1000}
                              onChange={(event) =>
                                setReason(event.target.value)
                              }
                              rows={3}
                              className={input}
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={
                                busy ||
                                (decision === "rejected" && !reason.trim())
                              }
                              onClick={() => void confirm()}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
                            >
                              {busy ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Check size={16} />
                              )}
                              ยืนยัน
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setDecision(null);
                                setReviewError("");
                              }}
                              className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {reviewError && (
                    <p role="alert" className="text-sm text-rose-600">
                      {reviewError}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </section>
  );
}
