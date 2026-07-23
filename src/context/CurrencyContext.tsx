"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

export function getCurrencySymbol(currencyInput?: string | null): string {
  if (!currencyInput) return "$";
  const trimmed = currencyInput.trim();
  const upper = trimmed.toUpperCase();

  // 1. Direct match in dictionary
  if (CURRENCY_SYMBOLS[upper]) {
    return CURRENCY_SYMBOLS[upper];
  }

  // 2. Check for standard currency symbol characters embedded in string
  for (const sym of ["₹", "€", "£", "$", "¥", "₱", "R$"]) {
    if (trimmed.includes(sym)) return sym;
  }

  // 3. Extract 3-letter ISO code match if input is e.g. "INR - Indian Rupee"
  const isoMatch = upper.match(/\b([A-Z]{3})\b/);
  if (isoMatch && CURRENCY_SYMBOLS[isoMatch[1]]) {
    return CURRENCY_SYMBOLS[isoMatch[1]];
  }

  // 4. Try browser Intl.NumberFormat
  try {
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency: upper });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    if (symbolPart) return symbolPart.value;
  } catch {
    // Fallback if Intl is unavailable or fails
  }

  return trimmed;
}

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
  const [currency, setCurrencyState] = useState<string>("USD");

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
    // 1. Load cached currency from localStorage for quick initial render
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("pos_tenant_currency");
        if (saved) {
          setCurrencyState(saved);
        }
      } catch {
        // Ignore localStorage errors
      }
    }

    // 2. Sync with database
    refreshCurrency();

    // 3. Listen for currency updates across components/tabs
    const handleCurrencyChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setCurrencyState(customEvent.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pos_tenant_currency" && e.newValue) {
        setCurrencyState(e.newValue);
      }
    };

    window.addEventListener("pos_currency_changed", handleCurrencyChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("pos_currency_changed", handleCurrencyChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [refreshCurrency]);

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
