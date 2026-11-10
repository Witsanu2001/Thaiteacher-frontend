import type { ReactNode } from "react";
import { FinancePageContext, type FinancePageState } from "./financePageState";

export function FinancePageProvider({ value, children }: { value: FinancePageState; children: ReactNode }) {
  return <FinancePageContext.Provider value={value}>{children}</FinancePageContext.Provider>;
}
