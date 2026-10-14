"use client";

import React, { createContext, useContext, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { getCurrencySymbol, CURRENCY_SYMBOLS, formatCurrencyAmount } from "@/lib/currency";

export { getCurrencySymbol, CURRENCY_SYMBOLS, formatCurrencyAmount };

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  setCurrency: (newCurrency: string, persistToDb?: boolean) => void;
  refreshCurrency: () => Promise<void>;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

const STORAGE_KEY = "pos_tenant_currency";
const DEFAULT_CURRENCY = "USD";

const CurrencyContext = createContext<CurrencyContextType>({
  currency: DEFAULT_CURRENCY,
  currencySymbol: "$",
  setCurrency: () => {},
  refreshCurrency: async () => {},
  formatCurrency: (amount) => formatCurrencyAmount(amount, "$"),
});

const CHANGE_EVENT = "pos_currency_changed";

// localStorage is the client-side source of truth; read via useSyncExternalStore so the
// server render (USD) and first client render agree, and other tabs stay in sync.
function readStoredCurrency(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().toUpperCase();
  } catch {}
  return DEFAULT_CURRENCY;
}

function writeStoredCurrency(value: string | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value.trim().toUpperCase());
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  } catch {
    // Handle localStorage quota or disabled error
  }
}

function subscribeToCurrency(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const tenantStatus = (session?.user as any)?.tenant_status;

  const currency = useSyncExternalStore(subscribeToCurrency, readStoredCurrency, () => DEFAULT_CURRENCY);

  const refreshCurrency = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile");
      if (res.ok) {
        const data = await res.json();
        const serverCurr = data.tenant?.currency || data.user?.currency_preference;
        if (serverCurr) {
          writeStoredCurrency(serverCurr);
        }
      }
    } catch {
      // Quietly ignore network failures
    }
  }, []);

  const updateCurrency = useCallback((newCurr: string, persistToDb = true) => {
    if (!newCurr) return;
    const previous = readStoredCurrency();
    writeStoredCurrency(newCurr);

    if (persistToDb) {
      fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: newCurr.trim().toUpperCase() }),
      })
        .then((res) => {
          // Don't leave the UI showing a currency that was never saved
          if (!res.ok) writeStoredCurrency(previous);
        })
        .catch(() => writeStoredCurrency(previous));
    }
  }, []);

  // Re-sync whenever the signed-in user (or their store's onboarding state) changes.
  // The provider lives in the root layout, so a mount-only sync would miss client-side logins.
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      // Don't carry one account's currency over to the next person on this device
      writeStoredCurrency(null);
      return;
    }
    refreshCurrency();
  }, [status, userId, tenantStatus, refreshCurrency]);

  const currencySymbol = getCurrencySymbol(currency);

  const formatCurrency = useCallback(
    (amount: number | string | null | undefined): string => {
      return formatCurrencyAmount(amount, currencySymbol);
    },
    [currencySymbol]
  );

  // Stable context value: the provider sits at the root and re-renders on every session update
  // (SessionProvider refetches on window focus), which would otherwise re-render every consumer.
  const value = useMemo<CurrencyContextType>(
    () => ({
      currency,
      currencySymbol,
      setCurrency: updateCurrency,
      refreshCurrency,
      formatCurrency,
    }),
    [currency, currencySymbol, updateCurrency, refreshCurrency, formatCurrency]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
