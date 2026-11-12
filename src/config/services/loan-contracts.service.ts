import axios from "axios";
import type { User } from "firebase/auth";
import { activeDataVersion } from "../../shared/funtion/scopedStorage";
import type { LoanAttachment, LoanContract } from "../../modules/loan-contracts/loanContract";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const loanUrl = (viewAsUid?: string) => `${API_URL}/api/v1/schools/finance/loan-contracts${viewAsUid ? `?viewAsUid=${encodeURIComponent(viewAsUid)}` : ""}`;
const attachmentUrl = `${API_URL}/api/v1/schools/finance/loan-attachments`;
type StoredLoan = { id: string; data: string; version: string; updatedAt: string };
export type VersionedLoan = LoanContract & { version?: string };

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "X-Data-Version": String(activeDataVersion()) };
}

export async function loadLoanContracts(user: User, viewAsUid?: string): Promise<VersionedLoan[]> {
  const response = await axios.get<StoredLoan[]>(loanUrl(viewAsUid), { headers: await headers(user) });
  return response.data.map((row) => ({ ...JSON.parse(row.data) as LoanContract, id: row.id, version: row.version, updatedAt: row.updatedAt }));
}

export async function saveLoanContract(user: User, contract: VersionedLoan, viewAsUid?: string): Promise<VersionedLoan> {
  const { version, ...data } = contract;
  const response = await axios.put<StoredLoan>(loanUrl(viewAsUid), {
    id: contract.id,
    data,
    ...(version ? { expectedVersion: version } : {}),
  }, { headers: await headers(user) });
  return { ...data, version: response.data.version, updatedAt: response.data.updatedAt };
}

export async function approveLoanContract(user: User, contract: VersionedLoan, viewAsUid?: string): Promise<VersionedLoan> {
  const response = await axios.post<StoredLoan>(loanUrl(viewAsUid), {
    id: contract.id,
    expectedVersion: contract.version,
  }, { headers: await headers(user) });
  return { ...JSON.parse(response.data.data) as LoanContract, id: response.data.id, version: response.data.version, updatedAt: response.data.updatedAt };
}

export async function deleteLoanContract(user: User, contract: VersionedLoan, viewAsUid?: string): Promise<void> {
  await axios.delete(loanUrl(viewAsUid), { params: { id: contract.id }, headers: { ...await headers(user), "If-Match": contract.version || "" } });
}

export async function uploadLoanAttachment(user: User, contractId: string, side: "front" | "back", file: File, viewAsUid?: string): Promise<LoanAttachment> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const fallbackType: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const contentType = file.type || fallbackType[extension || ""];
  const response = await axios.post<{ file: string }>(attachmentUrl, file, {
    params: { contractId, side, ...(viewAsUid ? { viewAsUid } : {}) },
    headers: { ...await headers(user), "Content-Type": contentType },
  });
  return { file: response.data.file, name: file.name, contentType, size: file.size, side };
}

export async function readLoanAttachment(user: User, contractId: string, attachment: LoanAttachment, viewAsUid?: string): Promise<Blob> {
  const response = await axios.get<Blob>(attachmentUrl, {
    params: { contractId, side: attachment.side, file: attachment.file, ...(viewAsUid ? { viewAsUid } : {}) },
    headers: await headers(user), responseType: "blob",
  });
  return response.data;
}

export async function deleteLoanAttachment(user: User, contractId: string, attachment: LoanAttachment, viewAsUid?: string): Promise<void> {
  await axios.delete(attachmentUrl, {
    params: { contractId, side: attachment.side, file: attachment.file, ...(viewAsUid ? { viewAsUid } : {}) },
    headers: await headers(user),
  });
}
