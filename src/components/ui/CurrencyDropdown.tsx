"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  // Only owners can change the store currency (enforced by PATCH /api/account/profile)
  const canChange = (session?.user as any)?.role === "OWNER";
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        triggerRef.current?.focus();
      }
    }

    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      focusTimer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeDropdown]);

  const handleSelect = (c: CurrencyInfo) => {
    setCurrency(c.code);
    closeDropdown();
    triggerRef.current?.focus();
  };

  const isDark = variant === "dark";

  return (
    <div className={clsx("relative inline-block text-left", className)} ref={dropdownRef}>
      {/* Trigger: quiet nav-link on the black global nav; hairline pill on light surfaces */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => canChange && setIsOpen(!isOpen)}
        disabled={!canChange}
        className={clsx(
          "press flex items-center gap-1.5 cursor-pointer select-none shrink-0 disabled:cursor-default",
          isDark
            ? "h-8 px-2 text-nav-link text-on-dark/80"
            : "min-h-9 px-3.5 rounded-full border border-hairline bg-canvas text-caption text-ink"
        )}
        title={`Current Currency: ${activeCurrency.name} (${activeCurrency.symbol})${canChange ? " - Click to change" : ""}`}
        aria-label={canChange ? `Store currency: ${activeCurrency.code}. Change store currency` : `Store currency: ${activeCurrency.code}`}
        aria-expanded={canChange ? isOpen : undefined}
        aria-haspopup={canChange ? "listbox" : undefined}
      >
        <span className="leading-none shrink-0 flex items-center" aria-hidden="true">{activeCurrency.flag}</span>
        <span className="font-semibold">{activeCurrency.code}</span>
        <span className={clsx("hidden sm:inline tabular", isDark ? "text-on-dark/60" : "text-ink-48")}>
          {activeCurrency.symbol}
        </span>
        {canChange && <ChevronDown
          aria-hidden="true"
          className={clsx(
            "size-3 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180",
            isDark ? "text-on-dark/60" : "text-ink-48"
          )}
        />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-hairline bg-canvas text-ink z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Search */}
          <div className="p-3 border-b border-divider-soft space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-ink">
                <Coins className="size-4 text-ink-48" aria-hidden="true" />
                Store currency
              </span>
              <span className="text-fine-print text-ink-48 tabular">
                {SUPPORTED_CURRENCIES.length} available
              </span>
            </div>

            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-48"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currency, code or symbol..."
                aria-label="Search currencies"
                className="w-full min-h-9 pl-9 pr-9 py-1.5 text-caption rounded-full border border-hairline bg-canvas text-ink placeholder:text-ink-48"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="press absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-full text-ink-48 cursor-pointer"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Currency List */}
          <div role="listbox" aria-label="Currencies" className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filteredCurrencies.length === 0 ? (
              <div className="py-6 text-center text-caption text-ink-48">
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
                      "press w-full flex items-center justify-between px-3 py-2 rounded-sm text-caption cursor-pointer text-left",
                      isSelected ? "bg-parchment text-ink font-semibold" : "text-ink"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                      <span className="leading-none shrink-0 select-none" aria-hidden="true">{c.flag}</span>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold">{c.code}</span>
                        <span className="truncate font-normal text-ink-48">{c.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-fine-print text-ink-48 tabular">{c.symbol}</span>
                      {isSelected && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
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
