"use client";

import { useState, useRef, useEffect } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { SUPPORTED_CURRENCIES, CurrencyInfo } from "@/lib/currency";
import { ChevronDown, Search, Check, Globe } from "lucide-react";
import clsx from "clsx";

interface CurrencyDropdownProps {
  variant?: "light" | "dark";
  className?: string;
  showName?: boolean;
}

export function CurrencyDropdown({
  variant = "light",
  className,
  showName = false,
}: CurrencyDropdownProps) {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeCurrency =
    SUPPORTED_CURRENCIES.find((c) => c.code === currency) || {
      code: currency || "USD",
      symbol: "$",
      name: "US Dollar",
      flag: "🌐",
    };

  const filteredCurrencies = SUPPORTED_CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (c: CurrencyInfo) => {
    setCurrency(c.code);
    setIsOpen(false);
    setSearch("");
  };

  const isDark = variant === "dark";

  return (
    <div className={clsx("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-2xs cursor-pointer select-none",
          isDark
            ? "bg-slate-800/80 hover:bg-slate-700/80 text-white border-slate-700 hover:border-slate-600"
            : "bg-background hover:bg-muted text-foreground border-border hover:border-border/80"
        )}
        title="Change Currency"
        aria-label="Change currency"
      >
        <span className="text-sm leading-none">{activeCurrency.flag}</span>
        <span className="font-bold tracking-tight">{activeCurrency.code}</span>
        <span
          className={clsx(
            "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
            isDark ? "bg-slate-700 text-emerald-400" : "bg-muted text-muted-foreground"
          )}
        >
          {activeCurrency.symbol}
        </span>
        <ChevronDown
          className={clsx(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen && "rotate-180",
            isDark ? "text-slate-400" : "text-muted-foreground"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={clsx(
            "absolute right-0 mt-2 w-64 rounded-xl border shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150",
            isDark
              ? "bg-slate-900 border-slate-800 text-white"
              : "bg-popover border-border text-popover-foreground"
          )}
        >
          {/* Header & Search */}
          <div className={clsx("p-2 border-b", isDark ? "border-slate-800 bg-slate-950/40" : "border-border bg-muted/40")}>
            <div className="relative">
              <Search
                className={clsx(
                  "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
                  isDark ? "text-slate-500" : "text-muted-foreground"
                )}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currency or symbol..."
                className={clsx(
                  "w-full pl-8 pr-3 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1",
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:ring-emerald-500"
                    : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-primary"
                )}
              />
            </div>
          </div>

          {/* Currency List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-transparent space-y-0.5">
            {filteredCurrencies.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No currencies found
              </div>
            ) : (
              filteredCurrencies.map((c) => {
                const isSelected = c.code === currency;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={clsx(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                      isSelected
                        ? isDark
                          ? "bg-emerald-600 text-white font-bold"
                          : "bg-primary text-primary-foreground font-bold"
                        : isDark
                        ? "hover:bg-slate-800 text-slate-200"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base leading-none shrink-0">{c.flag}</span>
                      <div className="truncate">
                        <span className="font-bold">{c.code}</span>
                        <span
                          className={clsx(
                            "ml-1.5 text-[11px]",
                            isSelected
                              ? isDark
                                ? "text-emerald-100"
                                : "text-primary-foreground/80"
                              : isDark
                              ? "text-slate-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {c.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                          isSelected
                            ? isDark
                              ? "bg-emerald-700 text-white"
                              : "bg-primary-foreground/20 text-primary-foreground"
                            : isDark
                            ? "bg-slate-800 text-slate-300"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {c.symbol}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
