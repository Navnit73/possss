"use client";

// Shared building blocks for the /dashboard/reports/* pages, so every report uses the same design tokens
// (globals.css / @/lib/design), tabular numerals, and the same loading / error / table / pagination behaviour.
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Calendar, Columns3, Download, Filter, Printer, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { colors, chartSeries, chartTheme } from "@/lib/design";
import { Alert } from "@/components/ui/Alert";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/Page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

/* ------------------------------------------------------------------ data */

/**
 * Fetches a report for `params`, aborting stale requests. The previous response stays on screen while a new
 * one loads (content is dimmed instead of replaced by a full-page spinner), which keeps filter / page changes fast.
 */
export function useReportData<T = any>(url: string, params: object) {
  const key = JSON.stringify(params);
  const [data, setData] = useState<T | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    axios
      .get(url, { params: JSON.parse(key), signal: controller.signal })
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error(`Failed to fetch ${url}`, err);
        setError({ key, message: err.response?.data?.error || "Failed to load report data" });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(key);
      });
    return () => controller.abort();
  }, [url, key]);

  const isLoading = loadedKey !== key;
  return {
    data,
    isLoading,
    /** First load: nothing to show yet. */
    isInitialLoading: isLoading && data === null,
    error: error?.key === key && !isLoading ? error.message : null,
  };
}

/* ---------------------------------------------------------------- charts */

/**
 * One palette for every report chart, mapped onto @/lib/design: Action Blue leads, further series step
 * down the ink ladder (no extra hues). Keys are kept for compatibility with the chart modules.
 */
export const CHART = {
  primary: colors.primary, // main series (revenue)
  success: colors.ink, // second series (profit)
  danger: colors.ink48, // cost / loss series
  info: colors.ink80,
  warning: colors.chip,
  violet: colors.ink80,
  grid: chartTheme.grid.stroke,
  axis: colors.ink48,
  categorical: [...chartSeries] as string[],
};

export const PAYMENT_COLORS: Record<string, string> = {
  CASH: colors.ink,
  CARD: colors.ink48,
  UPI: colors.chip,
  OTHER: colors.ink80,
};

export const axisTick = { ...chartTheme.axisTick, fontFamily: "inherit" };
export const tooltipStyle = { ...chartTheme.tooltip.contentStyle, fontFamily: "inherit" };
export const legendStyle = { fontSize: 12, fontFamily: "inherit", color: colors.ink48 };

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
/** Short axis labels: 125000 → 125K. */
export const compact = (n: number) => compactFmt.format(Number(n) || 0);

/** "2026-10-14" → "14 Oct" for chart axes (string math: no timezone shift). */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (d: unknown) => {
  const [, m, day] = String(d).split("-");
  return m && day ? `${Number(day)} ${MONTHS[Number(m) - 1]}` : String(d);
};

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-48">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={i.dashed ? { border: `2px dashed ${i.color}` } : { backgroundColor: i.color }}
            aria-hidden="true"
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  legend,
  isEmpty,
  className,
  height = "h-72",
  children,
}: {
  title: string;
  legend?: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
  height?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-6 min-w-0 break-inside-avoid", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <h3 className="text-tagline text-ink">{title}</h3>
        {legend}
      </div>
      <div className={height}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center rounded-sm bg-parchment text-caption text-ink-48">
            No data for this period
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export function ChartsSkeleton({ rows = [2, 3] }: { rows?: number[] }) {
  return (
    <>
      {rows.map((cols, r) => (
        <div key={r} className={cn("grid grid-cols-1 gap-6", cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
          {Array.from({ length: cols }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-5 w-48 mb-6" />
              <Skeleton className="h-64 w-full" />
            </Card>
          ))}
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------------- filters */

export const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

export interface DateFilter {
  dateRange: string;
  startDate: string;
  endDate: string;
}

export function DateRangeFilter({
  value,
  onChange,
  disabled,
}: {
  value: DateFilter;
  onChange: (v: DateFilter) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Select
        aria-label="Date range"
        value={value.dateRange}
        onChange={(e) => onChange({ ...value, dateRange: e.target.value })}
        disabled={disabled}
        className="w-auto min-w-[150px]"
      >
        {DATE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      {value.dateRange === "custom" && (
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
          <Input
            type="date"
            aria-label="Start date"
            value={value.startDate}
            max={value.endDate || undefined}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            disabled={disabled}
            className="w-auto tabular"
          />
          <span className="text-caption text-ink-48">to</span>
          <Input
            type="date"
            aria-label="End date"
            value={value.endDate}
            min={value.startDate || undefined}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            disabled={disabled}
            className="w-auto tabular"
          />
        </div>
      )}
    </>
  );
}

/** Returns an error message when a custom range is incomplete or reversed, else null. */
export function validateDateFilter(f: DateFilter): string | null {
  if (f.dateRange !== "custom") return null;
  if (!f.startDate || !f.endDate) return "Please select both a start date and an end date.";
  if (f.startDate > f.endDate) return "The start date must be on or before the end date.";
  return null;
}

/** search-input: pill field with a leading muted magnifier. `className` sizes the wrapper. */
export function SearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48 pointer-events-none" aria-hidden="true" />
      <Input type="search" {...props} className="pl-10" />
    </div>
  );
}

export function ReportFilterBar({
  onSubmit,
  isLoading,
  onExport,
  isExporting,
  children,
}: {
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onExport: () => void;
  isExporting: boolean;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-canvas border border-hairline rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden"
    >
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Filter aria-hidden="true" />}
          {isLoading ? "Loading..." : "Apply"}
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onExport} loading={isExporting} disabled={isLoading}>
          {!isExporting && <Download aria-hidden="true" />}
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => window.print()} disabled={isLoading}>
          <Printer aria-hidden="true" />
          Print
        </Button>
      </div>
    </form>
  );
}

export function ReportError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert variant="destructive">{message}</Alert>;
}

/* ------------------------------------------------------------------ KPIs */

/** Report KPI tones → StatCard tones (status color on the figure only). */
const TONES = {
  default: "default",
  success: "success",
  danger: "destructive",
  warning: "warning",
  orange: "warning",
} as const;
export type Tone = keyof typeof TONES;

export interface Kpi {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
  sub?: React.ReactNode;
}

export function KpiGrid({ items, count: skeletonCount = 4 }: { items: Kpi[] | null | undefined | false; count?: number }) {
  const count = items ? items.length : skeletonCount;
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-5", count >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {items
        ? items.map((k) => (
            <StatCard
              key={k.label}
              className="min-w-0 break-inside-avoid"
              title={k.hint ?? k.label}
              label={<span className="block truncate">{k.label}</span>}
              value={k.value}
              hint={k.sub ? <span className="block truncate">{k.sub}</span> : undefined}
              tone={TONES[k.tone ?? "default"]}
            />
          ))
        : Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-canvas border border-hairline rounded-lg p-6">
              <Skeleton className="h-3.5 w-24 mb-4" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
    </div>
  );
}

/* ----------------------------------------------------------------- table */

export function useColumns<K extends string>(keys: readonly K[]) {
  const [visible, setVisible] = useState<Record<K, boolean>>(
    () => Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>,
  );
  const toggle = (k: K) => setVisible((v) => ({ ...v, [k]: !v[k] }));
  return { visible, toggle };
}

export function ColumnToggle<K extends string>({
  columns,
  visible,
  onToggle,
}: {
  columns: { key: K; label: string }[];
  visible: Record<K, boolean>;
  onToggle: (k: K) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (it previously stayed open until the button was clicked again)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative print:hidden">
      <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Columns3 aria-hidden="true" />
        Columns
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-canvas border border-hairline rounded-lg z-20 p-2 text-caption text-ink animate-in fade-in">
          {columns.map((c) => (
            <label key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-sm cursor-pointer">
              <input
                type="checkbox"
                checked={visible[c.key]}
                onChange={() => onToggle(c.key)}
                className="accent-primary size-4"
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function Pagination({
  meta,
  onPage,
  disabled,
}: {
  meta: PaginationMeta;
  onPage: (p: number) => void;
  disabled?: boolean;
}) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="px-6 py-4 border-t border-hairline flex items-center justify-between gap-3 print:hidden">
      <p className="text-caption text-ink-48 tabular">
        Showing {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => onPage(meta.page - 1)} disabled={disabled || meta.page <= 1}>
          Previous
        </Button>
        <span className="text-caption text-ink-48 tabular">
          {meta.page} / {Math.max(1, meta.totalPages)}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onPage(meta.page + 1)}
          disabled={disabled || meta.page >= meta.totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export interface ReportColumn<Row, K extends string = string> {
  key: K;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: Row, index: number) => React.ReactNode;
}

export function ReportTable<Row extends { _id?: unknown }, K extends string>({
  title,
  columns,
  visible,
  onToggle,
  rows,
  pagination,
  onPage,
  isLoading,
  emptyText = "No records found for the selected filters.",
}: {
  title: string;
  columns: ReportColumn<Row, K>[];
  visible: Record<K, boolean>;
  onToggle: (k: K) => void;
  rows: Row[] | null;
  pagination: PaginationMeta | null;
  onPage: (p: number) => void;
  isLoading: boolean;
  emptyText?: string;
}) {
  const shown = columns.filter((c) => visible[c.key]);
  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <Card className="overflow-hidden">
      <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-3">
        <h3 className="text-tagline text-ink">{title}</h3>
        <ColumnToggle columns={columns.map((c) => ({ key: c.key, label: c.label }))} visible={visible} onToggle={onToggle} />
      </div>
      <div className={cn("transition-opacity", isLoading && rows && "opacity-60")} aria-busy={isLoading}>
        <Table className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              {shown.map((c) => (
                <TableHead key={c.key} scope="col" className={alignCls(c.align)}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {shown.map((c) => (
                    <TableCell key={c.key}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(1, shown.length)} className="py-12 text-center text-ink-48">
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={String(row._id ?? i)}>
                  {shown.map((c) => (
                    <TableCell key={c.key} className={cn("tabular", alignCls(c.align), c.className)}>
                      {c.render(row, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && <Pagination meta={pagination} onPage={onPage} disabled={isLoading} />}
    </Card>
  );
}

/* ---------------------------------------------------------------- badges */

/** Report badge tones → Badge variants (status carried by text color only, never a tinted fill). */
const BADGE_TONES: Record<"neutral" | "success" | "info" | "violet" | "warning" | "orange" | "danger", NonNullable<BadgeProps["variant"]>> = {
  neutral: "secondary",
  success: "success",
  info: "secondary",
  violet: "secondary",
  warning: "warning",
  orange: "warning",
  danger: "destructive",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return <Badge variant={BADGE_TONES[tone]}>{children}</Badge>;
}

export const PAYMENT_BADGE: Record<string, keyof typeof BADGE_TONES> = {
  CASH: "success",
  CARD: "info",
  UPI: "violet",
  OTHER: "warning",
};

/** Signed money cell: +₹10.00 in the success tone, −₹4.00 in the destructive tone. */
export function Signed({ value, format }: { value: number; format: (n: number) => string }) {
  const v = Number(value) || 0;
  return (
    <span className={cn("font-semibold", v < 0 ? "text-destructive" : "text-success")}>
      {v > 0 ? "+" : ""}
      {format(v)}
    </span>
  );
}

/* ----------------------------------------------------------------- export */

/** Runs a CSV export with a shared error message. */
export async function runExport(url: string, params: object, toCsv: (rows: any[]) => void) {
  try {
    const res = await axios.get(url, { params: { ...params, export: true } });
    toCsv(res.data?.table?.data ?? []);
  } catch (err: any) {
    console.error("Failed to export report", err);
    const Swal = (await import("@/lib/swal")).default;
    Swal.fire("Error", err.response?.data?.error || "Failed to export report", "error");
  }
}

export async function warn(message: string) {
  const Swal = (await import("@/lib/swal")).default;
  Swal.fire("Check the filters", message, "warning");
}
