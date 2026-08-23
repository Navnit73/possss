"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCurrencySymbol, CURRENCY_SYMBOLS, formatCurrencyAmount } from "@/lib/currency";

export { getCurrencySymbol, CURRENCY_SYMBOLS, formatCurrencyAmount };

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
  formatCurrency: (amount) => formatCurrencyAmount(amount, "$"),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pos_tenant_currency");
        if (saved && saved.trim()) return saved.trim().toUpperCase();
      } catch {
        // Handle localStorage error
      }
    }
    return "USD";
  });

  const updateCurrency = useCallback((newCurr: string, persistToDb = true) => {
    if (!newCurr) return;
    const normalized = newCurr.trim().toUpperCase();
    setCurrencyState(normalized);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pos_tenant_currency", normalized);
        window.dispatchEvent(new CustomEvent("pos_currency_changed", { detail: normalized }));
      } catch {
        // Handle localStorage quota or disabled error
      }
    }

    if (persistToDb) {
      fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: normalized }),
      }).catch(() => {
        // Quietly fail network persistence
      });
    }
  }, []);

  const refreshCurrency = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile");
      if (res.ok) {
        const data = await res.json();
        const serverCurr = data.tenant?.currency || data.user?.currency_preference;
        if (serverCurr) {
          updateCurrency(serverCurr, false);
        }
      }
    } catch {
      // Quietly ignore network failures on initial load
    }
  }, [updateCurrency]);

  useEffect(() => {
    let isMounted = true;

    // 1. Check server on initial mount
    const sync = async () => {
      try {
        const res = await fetch("/api/account/profile");
        if (res.ok && isMounted) {
          const data = await res.json();
          const serverCurr = data.tenant?.currency || data.user?.currency_preference;
          if (serverCurr) {
            const normalized = serverCurr.trim().toUpperCase();
            setCurrencyState(normalized);
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("pos_tenant_currency", normalized);
              } catch {}
            }
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
        setCurrencyState(customEvent.detail.toString().toUpperCase());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pos_tenant_currency" && e.newValue && isMounted) {
        setCurrencyState(e.newValue.toUpperCase());
      }
    };

    window.addEventListener("pos_currency_changed", handleCurrencyChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener("pos_currency_changed", handleCurrencyChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const currencySymbol = getCurrencySymbol(currency);

  const formatCurrency = useCallback(
    (amount: number | string | null | undefined): string => {
      return formatCurrencyAmount(amount, currencySymbol);
    },
    [currencySymbol]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencySymbol,
        setCurrency: (code: string) => updateCurrency(code, true),
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
