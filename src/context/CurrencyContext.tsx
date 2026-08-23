"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCurrencySymbol, CURRENCY_SYMBOLS } from "@/lib/currency";

export { getCurrencySymbol, CURRENCY_SYMBOLS };

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (newCurrency: string) => void;
  refreshCurrency: () => Promise<void>;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  currencySymbol: "$",
  setCurrency: () => {},
  refreshCurrency: async () => {},
  formatCurrency: (amount) => {
    const num = Number(amount);
    const val = isNaN(num) ? 0 : num;
    return `$${val.toFixed(2)}`;
  },
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("pos_tenant_currency") || "USD";
      } catch {
        return "USD";
      }
    }
    return "USD";
  });

  const updateCurrency = useCallback((newCurr: string) => {
    if (!newCurr) return;
    setCurrencyState((prev) => (prev !== newCurr ? newCurr : prev));
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pos_tenant_currency", newCurr);
        window.dispatchEvent(new CustomEvent("pos_currency_changed", { detail: newCurr }));
      } catch {
        // Handle potential localStorage disabled/quota errors
      }
    }
  }, []);

  const refreshCurrency = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.tenant?.currency) {
          updateCurrency(data.tenant.currency);
        }
      }
    } catch {
      // Quietly ignore network failures on initial load
    }
  }, [updateCurrency]);

  useEffect(() => {
    let isMounted = true;
    
    // 1. Sync with database
    const sync = async () => {
      try {
        const res = await fetch("/api/account/profile");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.tenant?.currency) {
            updateCurrency(data.tenant.currency);
          }
        }
      } catch {
        // Ignore initial sync failure
      }
    };
    sync();

    // 2. Listen for currency updates across components/tabs
    const handleCurrencyChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && isMounted) {
        setCurrencyState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pos_tenant_currency" && e.newValue && isMounted) {
        setCurrencyState(e.newValue);
      }
    };

    window.addEventListener("pos_currency_changed", handleCurrencyChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener("pos_currency_changed", handleCurrencyChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [updateCurrency]);

  const currencySymbol = getCurrencySymbol(currency);

  const formatCurrency = useCallback(
    (amount: number | string | null | undefined): string => {
      const num = Number(amount);
      const val = isNaN(num) ? 0 : num;
      return `${currencySymbol}${val.toFixed(2)}`;
    },
    [currencySymbol]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency: updateCurrency,
        refreshCurrency,
        formatCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
