"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { SUPPORTED_CURRENCIES, CurrencyInfo } from "@/lib/currency";
import { ChevronDown, Search, Check, X, Coins } from "lucide-react";
import clsx from "clsx";

interface CurrencyDropdownProps {
  variant?: "light" | "dark";
  className?: string;
  showName?: boolean;
}

export function CurrencyDropdown({
  variant = "light",
  className,
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

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        closeDropdown();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  const handleSelect = (c: CurrencyInfo) => {
    setCurrency(c.code);
    closeDropdown();
  };

  const isDark = variant === "dark";

  return (
    <div className={clsx("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-2xs cursor-pointer select-none shrink-0",
          isDark
            ? "bg-slate-800/90 hover:bg-slate-750 text-white border-slate-700 hover:border-emerald-500/50 focus-visible:ring-2 focus-visible:ring-emerald-500"
            : "bg-surface hover:bg-muted text-foreground border-border hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
        )}
        title={`Current Currency: ${activeCurrency.name} (${activeCurrency.symbol}) - Click to change`}
        aria-label="Change Store Currency"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-sm leading-none shrink-0 flex items-center">{activeCurrency.flag}</span>
        <span className="font-bold tracking-tight text-xs">{activeCurrency.code}</span>
        <span
          className={clsx(
            "hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors",
            isDark
              ? "bg-slate-700/80 text-emerald-400 group-hover:bg-emerald-950/60"
              : "bg-muted text-muted-foreground group-hover:text-foreground"
          )}
        >
          {activeCurrency.symbol}
        </span>
        <ChevronDown
          className={clsx(
            "w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180",
            isDark ? "text-slate-400 group-hover:text-white" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={clsx(
            "absolute right-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 backdrop-blur-sm",
            isDark
              ? "bg-slate-900/98 border-slate-800 text-white shadow-black/60"
              : "bg-popover/98 border-border text-popover-foreground shadow-slate-900/15"
          )}
        >
          {/* Header & Search */}
          <div className={clsx("p-2.5 border-b space-y-2", isDark ? "border-slate-800 bg-slate-950/60" : "border-border bg-muted/40")}>
            <div className="flex items-center justify-between text-[11px] font-bold px-1">
              <span className={clsx("flex items-center gap-1.5", isDark ? "text-slate-300" : "text-foreground")}>
                <Coins className={clsx("w-3.5 h-3.5", isDark ? "text-emerald-400" : "text-primary")} />
                Store Currency
              </span>
              <span className={clsx("text-[10px] font-medium px-1.5 py-0.2 rounded-full", isDark ? "bg-slate-800 text-slate-400" : "bg-muted text-muted-foreground")}>
                {SUPPORTED_CURRENCIES.length} available
              </span>
            </div>

            <div className="relative">
              <Search
                className={clsx(
                  "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
                  isDark ? "text-slate-400" : "text-muted-foreground"
                )}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currency, code or symbol..."
                className={clsx(
                  "w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border focus:outline-none transition-all",
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    : "bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
                )}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={clsx(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-700/50 cursor-pointer",
                    isDark ? "text-slate-400 hover:text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Currency List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredCurrencies.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No currencies matching &ldquo;{search}&rdquo;
              </div>
            ) : (
              filteredCurrencies.map((c) => {
                const isSelected = c.code === currency;
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(c)}
                    className={clsx(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                      isSelected
                        ? isDark
                          ? "bg-emerald-600 text-white font-bold shadow-2xs"
                          : "bg-primary text-primary-foreground font-bold shadow-2xs"
                        : isDark
                        ? "hover:bg-slate-800/80 text-slate-200 active:bg-slate-750"
                        : "hover:bg-muted text-foreground active:bg-muted/80"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                      <span className="text-base leading-none shrink-0 select-none">{c.flag}</span>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{c.code}</span>
                          <span
                            className={clsx(
                              "text-[11px] truncate font-normal",
                              isSelected
                                ? isDark
                                  ? "text-emerald-100"
                                  : "text-primary-foreground/90"
                                : isDark
                                ? "text-slate-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {c.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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
