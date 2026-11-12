import { createContext, useContext, type ReactNode } from "react";
import type { DailyReport } from "../../shared/funtion/types";
import type { User } from "firebase/auth";

export type FinancePageState = {
  importMessage: string;
  school: string;
  schoolKey: string;
  fiscalYear: number;
  report?: DailyReport | null;
  yearReports: DailyReport[];
  allReports: DailyReport[];
  user?: User;
  viewAsUid?: string;
  demo: boolean;
  categories: string[];
  reportFormDate: string;
  onPreview?: () => void;
  onNavigate: (page: string, incomeExpenseCategory?: string) => void;
  overview: ReactNode;
};

export const FinancePageContext = createContext<FinancePageState | null>(null);

export function useFinancePage() {
  const value = useContext(FinancePageContext);
  if (!value) throw new Error("FinancePageProvider is required");
  return value;
}
