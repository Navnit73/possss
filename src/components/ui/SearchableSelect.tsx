"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** id for the trigger button, so a <label htmlFor> can point at it */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Shows the error border (pair with an error message linked via aria-describedby on the field) */
  "aria-invalid"?: boolean;
}

// Rendering thousands of rows (e.g. full product catalogue, timezone list) on every keystroke is slow;
// show the first N matches and ask the user to narrow the search.
const MAX_RENDERED_OPTIONS = 200;

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const selectedOption = options.find((opt) => opt.value === value);

  const close = (returnFocus = false) => {
    setIsOpen(false);
    setSearchTerm("");
    if (returnFocus) triggerRef.current?.focus();
  };

  const open = () => {
    if (disabled) return;
    const selectedIdx = options.findIndex((opt) => opt.value === value);
    setActiveIndex(selectedIdx >= 0 && selectedIdx < MAX_RENDERED_OPTIONS ? selectedIdx : 0);
    setIsOpen(true);
  };

  // Close dropdown when clicking outside (only listen while open)
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return term ? options.filter((opt) => opt.label.toLowerCase().includes(term)) : options;
  }, [options, searchTerm]);
  const visibleOptions = filteredOptions.slice(0, MAX_RENDERED_OPTIONS);

  // Keep the highlighted option scrolled into view
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const select = (option: Option) => {
    onChange(option.value);
    close(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, visibleOptions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(Math.max(visibleOptions.length - 1, 0));
        break;
      case "Enter":
        // Don't submit the surrounding form
        e.preventDefault();
        if (visibleOptions[activeIndex]) select(visibleOptions[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        close();
        break;
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      open();
    }
  };

  return (
    <div className={cn("relative w-full", isOpen && "z-30", className)} ref={containerRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        data-invalid={ariaInvalid || undefined}
        data-field=""
        className={cn(
          "flex min-h-11 w-full items-center justify-between rounded-full border border-hairline bg-canvas px-5 py-2.5 text-body text-ink cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:border-primary-focus data-invalid:border-destructive",
          !selectedOption && "text-ink-48"
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 text-ink-48" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute top-full z-50 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-hairline bg-canvas text-ink animate-in fade-in zoom-in-95" ref={listRef}>
          <div className="sticky top-0 z-10 flex items-center border-b border-hairline bg-canvas px-4">
            <Search className="mr-2 size-3.5 shrink-0 text-ink-48" aria-hidden="true" />
            <input
              role="combobox"
              aria-expanded={true}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={visibleOptions[activeIndex] ? optionId(activeIndex) : undefined}
              aria-label="Search options"
              className="flex h-11 w-full bg-transparent py-3 text-body text-ink outline-none placeholder:text-ink-48 disabled:cursor-not-allowed disabled:opacity-40"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
          </div>
          <div className="p-1.5" role="listbox" id={listboxId} aria-label={ariaLabel ?? placeholder}>
            {visibleOptions.length === 0 ? (
              <div className="py-6 text-center text-caption text-ink-48" role="presentation">
                No results found.
              </div>
            ) : (
              visibleOptions.map((option, index) => {
                const isSelected = value === option.value;
                const isActive = index === activeIndex;
                return (
                  <div
                    key={option.value}
                    id={optionId(index)}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-8 text-caption text-ink outline-none",
                      isActive && "bg-parchment",
                      isSelected && "font-semibold"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    // Keep focus in the search box so keyboard navigation continues to work
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(option)}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                        <Check className="size-4 text-primary" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                );
              })
            )}
            {filteredOptions.length > MAX_RENDERED_OPTIONS && (
              <div className="px-2 py-2 text-center text-fine-print text-ink-48" role="presentation">
                Showing first {MAX_RENDERED_OPTIONS} of {filteredOptions.length} — type to narrow results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
