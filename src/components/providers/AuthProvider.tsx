"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { CurrencyProvider } from "@/context/CurrencyContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyProvider>{children}</CurrencyProvider>
    </SessionProvider>
  );
}
