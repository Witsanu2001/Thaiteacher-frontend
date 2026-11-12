import { todayIso } from "../../shared/funtion/fiscalYear";

export type LoanExpense = { id: string; description: string; amount: string };
export type LoanRepayment = { id: string; date: string; description: string; amount: string; receiptNo: string };
export type LoanAttachment = { file: string; name: string; contentType: string; size: number; side: "front" | "back" };
export type LoanContract = {
  id: string;
  number: string;
  loanDate: string;
  dueDate: string;
  submittedTo: string;
  borrower: string;
  position: string;
  affiliation: string;
  province: string;
  borrowFrom: string;
  sourceReportDate?: string;
  sourceCategory?: string;
  sourceRowIndex?: number;
  sourceAccount?: "cash" | "bank" | "government";
  purpose: string;
  expenses: LoanExpense[];
  amountWords: string;
  repaymentDays: string;
  repayments: LoanRepayment[];
  frontAttachment?: LoanAttachment;
  backAttachments?: LoanAttachment[];
  updatedAt: string;
  approvedAt?: string;
};

export const newId = () => crypto.randomUUID();
export const emptyExpense = (): LoanExpense => ({ id: newId(), description: "", amount: "" });
export const emptyRepayment = (): LoanRepayment => ({ id: newId(), date: "", description: "", amount: "", receiptNo: "" });
export const newContract = (school: string): LoanContract => ({
  id: newId(), number: "", loanDate: todayIso(), dueDate: "",
  submittedTo: `ผู้อำนวยการ${school}`, borrower: "", position: "", affiliation: "",
  province: "", borrowFrom: "", sourceReportDate: "", sourceCategory: "", purpose: "", expenses: [emptyExpense()],
  amountWords: "", repaymentDays: "", repayments: [], updatedAt: "",
});

export const toAmount = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0;
};
export const loanTotal = (contract: LoanContract) => contract.expenses.reduce((sum, item) => sum + toAmount(item.amount), 0);
export const loanOutstanding = (contract: LoanContract) => Math.max(0, loanTotal(contract) - (contract.repayments || []).reduce((sum, item) => sum + toAmount(item.amount), 0));

const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
function sixDigits(value: number) {
  const padded = String(value).padStart(6, "0");
  let output = "";
  for (let index = 0; index < 6; index++) {
    const digit = Number(padded[index]);
    const place = 5 - index;
    if (!digit) continue;
    if (place === 1 && digit === 1) output += "สิบ";
    else if (place === 1 && digit === 2) output += "ยี่สิบ";
    else if (place === 0 && digit === 1 && output) output += "เอ็ด";
    else output += digits[digit] + units[place];
  }
  return output;
}
export function thaiBahtText(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 999_999_999_999.99) return "";
  const cents = Math.round(value * 100);
  const whole = Math.floor(cents / 100);
  const satang = cents % 100;
  let baht = whole === 0 ? digits[0] : "";
  const millions = Math.floor(whole / 1_000_000);
  const rest = whole % 1_000_000;
  if (millions) baht += sixDigits(millions) + "ล้าน";
  if (rest) baht += sixDigits(rest);
  return `${baht}บาท${satang ? sixDigits(satang) + "สตางค์" : "ถ้วน"}`;
}
