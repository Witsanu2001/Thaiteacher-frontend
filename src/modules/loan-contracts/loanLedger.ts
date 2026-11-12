import type { CashbookEntry } from "../../shared/funtion/types";
import { loanTotal, toAmount, type LoanContract } from "./loanContract";

/** Loan entries are derived from the approved contract, so they cannot drift from it. */
export function loanLedgerEntries(contracts: LoanContract[]): CashbookEntry[] {
  return contracts.flatMap((contract) => {
    if (!contract.approvedAt || !contract.sourceCategory || !contract.sourceAccount) return [];
    const shared = { category: contract.sourceCategory, account: contract.sourceAccount, party: contract.borrower };
    const expense: CashbookEntry = {
      ...shared, id: `loan:${contract.id}:approval`, date: contract.loanDate,
      kind: "expense", documentNo: contract.number,
      description: `จ่ายเงินยืม ${contract.borrower}`,
      amount: loanTotal(contract), note: contract.purpose,
    };
    const receipts: CashbookEntry[] = (contract.repayments || []).filter((item) => toAmount(item.amount) > 0).map((item) => ({
      ...shared, id: `loan:${contract.id}:repayment:${item.id}`, date: item.date,
      kind: "income", documentNo: item.receiptNo,
      description: item.description || `ส่งใช้เงินยืม ${contract.borrower}`,
      amount: toAmount(item.amount), note: `ส่งใช้สัญญายืม ${contract.number || contract.id}`,
    }));
    return [expense, ...receipts];
  });
}
