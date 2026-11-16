import { createContext, useContext } from "react";
export const FinanceReadOnlyContext = createContext(false);
export const useFinanceReadOnly = () => useContext(FinanceReadOnlyContext);
