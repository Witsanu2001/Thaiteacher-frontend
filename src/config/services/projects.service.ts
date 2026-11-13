import axios from "axios";
import type { User } from "firebase/auth";
import { activeDataVersion } from "../../shared/funtion/scopedStorage";
import type { SchoolProject } from "../../modules/projects/projectModel";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const projectsUrl = `${API_URL}/api/v1/schools/finance/projects`;
const attachmentsUrl = `${API_URL}/api/v1/schools/finance/project-attachments`;
const expensesUrl = `${API_URL}/api/v1/schools/finance/project-expenses`;

export type ProjectAttachment = { name: string; file?: string; dataUrl?: string; contentType?: string; size?: number; pendingFile?: File };
export type ProjectExpense = {
  id: string; activityId: string; allocationId: string; date: string; category: string;
  description: string; amount: number; documentNo: string; note: string; attachment?: ProjectAttachment;
  account?: "cash" | "bank" | "government";
};
type StoredProject = { id: string; data: string; version: string; updatedAt: string };
export type LoadedProject = { project: SchoolProject; expenses: ProjectExpense[] };

async function headers(user: User) {
  return { Authorization: `Bearer ${await user.getIdToken()}`, "X-Data-Version": String(activeDataVersion()) };
}
const params = (viewAsUid?: string) => viewAsUid ? { viewAsUid } : {};

export async function loadProjects(user: User, viewAsUid?: string): Promise<LoadedProject[]> {
  const response = await axios.get<StoredProject[]>(projectsUrl, { headers: await headers(user), params: params(viewAsUid) });
  return response.data.map((record) => {
    const data = JSON.parse(record.data) as SchoolProject & { expenses?: ProjectExpense[] };
    const { expenses = [], ...project } = data;
    return { project: { ...project, version: record.version }, expenses };
  });
}
export async function saveProject(user: User, project: SchoolProject, expenses: ProjectExpense[], viewAsUid?: string): Promise<SchoolProject> {
  const { version, ...data } = project;
  const sanitizedExpenses = expenses.map((expense) => ({ ...expense, attachment: expense.attachment?.file ? { name: expense.attachment.name, file: expense.attachment.file, contentType: expense.attachment.contentType, size: expense.attachment.size } : undefined }));
  const response = await axios.put<StoredProject>(projectsUrl, { id: project.id, data: { ...data, expenses: sanitizedExpenses }, ...(version ? { expectedVersion: version } : {}) }, { headers: await headers(user), params: params(viewAsUid) });
  return { ...data, version: response.data.version };
}
export async function deleteProject(user: User, project: SchoolProject, viewAsUid?: string): Promise<void> {
  await axios.delete(projectsUrl, { headers: { ...await headers(user), "If-Match": project.version || "" }, params: { ...params(viewAsUid), id: project.id } });
}
export async function saveProjectExpense(user: User, project: SchoolProject, expense: ProjectExpense, viewAsUid?: string): Promise<SchoolProject> {
  const { attachment, ...record } = expense;
  const safe = { ...record, ...(attachment?.file ? { attachment: { name: attachment.name, file: attachment.file, contentType: attachment.contentType, size: attachment.size } } : {}) };
  const response = await axios.put<StoredProject>(expensesUrl, { projectId: project.id, expectedVersion: project.version, expense: safe }, { headers: await headers(user), params: params(viewAsUid) });
  const { expenses: _expenses, ...updated } = JSON.parse(response.data.data) as SchoolProject & { expenses: ProjectExpense[] };
  void _expenses;
  return { ...updated, version: response.data.version };
}
export async function removeProjectExpense(user: User, project: SchoolProject, expenseId: string, viewAsUid?: string): Promise<SchoolProject> {
  const response = await axios.delete<StoredProject>(expensesUrl, { headers: await headers(user), params: params(viewAsUid), data: { projectId: project.id, expectedVersion: project.version, expenseId } });
  return { ...project, version: response.data.version };
}
export async function uploadProjectAttachment(user: User, projectId: string, expenseId: string, file: File, viewAsUid?: string): Promise<ProjectAttachment> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  const contentType = types[extension || ""];
  if (!contentType) throw new Error("ไฟล์แนบไม่รองรับ");
  const response = await axios.post<{ file: string }>(attachmentsUrl, file, { headers: { ...await headers(user), "Content-Type": contentType }, params: { ...params(viewAsUid), projectId, expenseId } });
  return { name: file.name, file: response.data.file, contentType, size: file.size };
}
export async function downloadProjectAttachment(user: User, projectId: string, expenseId: string, attachment: ProjectAttachment, viewAsUid?: string): Promise<void> {
  if (!attachment.file) return;
  const response = await axios.get<Blob>(attachmentsUrl, { headers: await headers(user), params: { ...params(viewAsUid), projectId, expenseId, file: attachment.file }, responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a"); link.href = url; link.download = attachment.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export async function deleteProjectAttachment(user: User, projectId: string, expenseId: string, attachment: ProjectAttachment, viewAsUid?: string): Promise<void> {
  if (!attachment.file) return;
  await axios.delete(attachmentsUrl, { headers: await headers(user), params: { ...params(viewAsUid), projectId, expenseId, file: attachment.file } });
}
