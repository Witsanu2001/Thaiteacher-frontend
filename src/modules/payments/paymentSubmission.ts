import type { User } from "firebase/auth";
import { getMetadata, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../config/firebase";
import { createPaymentRequest, getPaymentRequests, type PaymentRequest } from "../../config/services/payments.service";
import { paymentConfig } from "./paymentConfig";

export type ValidatedSlip = { file: File; contentType: string; extension: string };
export type PaymentAttempt = { id: string; path: string; uid: string; slip: ValidatedSlip; uploadStarted: boolean; uploaded: boolean; submitted: boolean };

export async function validateSlip(file: File): Promise<ValidatedSlip> {
  if (!file.size || file.size >= 10 * 1024 * 1024) throw new Error("เลือกไฟล์ขนาดน้อยกว่า 10 MB และไม่ใช่ไฟล์ว่าง");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  let extension = "";
  let contentType = "";
  if (starts(0xff, 0xd8, 0xff)) { extension = "jpg"; contentType = "image/jpeg"; }
  else if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) { extension = "png"; contentType = "image/png"; }
  else if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) { extension = "pdf"; contentType = "application/pdf"; }
  else if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) { extension = "webp"; contentType = "image/webp"; }
  if (!extension) throw new Error("รองรับเฉพาะภาพ JPG, PNG, WebP และไฟล์ PDF เท่านั้น");
  return { file, contentType, extension };
}

export function newPaymentAttempt(uid: string, slip: ValidatedSlip): PaymentAttempt {
  const id = crypto.randomUUID().replaceAll("-", "");
  return { id, uid, path: `payment-slips/${uid}/${id}.${slip.extension}`, slip, uploadStarted: false, uploaded: false, submitted: false };
}

export async function submitPayment(user: User, attempt: PaymentAttempt, onStage: (stage: "uploading" | "submitting") => void): Promise<PaymentRequest> {
  if (attempt.uid !== user.uid) throw new Error("payment_account_changed");
  // Keep the same request and file on retry, including when the POST succeeded
  // but its response was lost. Storage allows creating a slip, not overwriting it.
  if (attempt.submitted) {
    const existing = (await getPaymentRequests(user)).find(item => item.id === attempt.id);
    if (existing) return existing;
  }
  const object = ref(storage, attempt.path);
  if (!attempt.uploaded && attempt.uploadStarted) {
    try {
      const metadata = await getMetadata(object);
      if (metadata.size !== attempt.slip.file.size || metadata.contentType !== attempt.slip.contentType) throw new Error("payment_file_mismatch");
      attempt.uploaded = true;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "storage/object-not-found")) throw error;
    }
  }
  if (!attempt.uploaded) {
    onStage("uploading");
    attempt.uploadStarted = true;
    await uploadBytes(object, attempt.slip.file, { contentType: attempt.slip.contentType });
    attempt.uploaded = true;
  }
  onStage("submitting");
  attempt.submitted = true;
  try {
    return await createPaymentRequest(user, { id: attempt.id, amount: paymentConfig.amount, slipPath: attempt.path });
  } catch (error) {
    // A successful write must not become a duplicate after a network timeout.
    try {
      const existing = (await getPaymentRequests(user)).find(item => item.id === attempt.id);
      if (existing) return existing;
    } catch { /* Preserve the original error and allow a retry. */ }
    throw error;
  }
}
