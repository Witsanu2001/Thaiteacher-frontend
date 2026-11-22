import { createContext, useContext } from "react";
export const FinanceReadOnlyContext = createContext(false);
export const useFinanceReadOnly = () => useContext(FinanceReadOnlyContext);

export const BillingPriceContext = createContext<number>(99);
export function useBillingPrice() { return useContext(BillingPriceContext); }
