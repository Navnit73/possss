"use client";

// Shared building blocks for the /dashboard/reports/* pages, so every report uses the same tokens
// (globals.css), the global font (Poppins + tabular numbers instead of monospace), and the same
// loading / error / table / pagination behaviour.
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Calendar, Columns3, Download, Filter, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";

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

/** One palette for every report chart, derived from the global tokens. */
export const CHART = {
  primary: "#0F172A", // --primary (revenue / main series)
  success: "#10B981", // --success (profit)
  danger: "#EF4444", // --destructive (cost / loss)
  info: "#0284C7",
  warning: "#F59E0B",
  violet: "#8B5CF6",
  grid: "#E2E8F0", // --border
  axis: "#64748B", // --muted-foreground
  categorical: ["#0F172A", "#10B981", "#0284C7", "#F59E0B", "#8B5CF6", "#EF4444", "#64748B", "#EC4899"],
};

export const PAYMENT_COLORS: Record<string, string> = {
  CASH: CHART.success,
  CARD: CHART.info,
  UPI: CHART.violet,
  OTHER: CHART.warning,
};

export const axisTick = { fontSize: 11, fill: CHART.axis, fontFamily: "inherit" };
export const tooltipStyle = {
  borderRadius: "var(--radius)",
  border: `1px solid ${CHART.grid}`,
  fontFamily: "inherit",
  fontSize: 12,
  boxShadow: "none",
};
export const legendStyle = { fontSize: 12, fontFamily: "inherit" };

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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
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
    <section className={cn("flat-card p-5 sm:p-6 min-w-0", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {legend}
      </div>
      <div className={height}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function ChartsSkeleton({ rows = [2, 3] }: { rows?: number[] }) {
  return (
    <>
      {rows.map((cols, r) => (
        <div key={r} className={cn("grid grid-cols-1 gap-6", cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="flat-card p-6">
              <Skeleton className="h-4 w-48 mb-6" />
              <Skeleton className="h-64 w-full" />
            </div>
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
        className="w-auto min-w-[150px] bg-surface"
      >
        {DATE_RANGES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>
      {value.dateRange === "custom" && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <Input
            type="date"
            aria-label="Start date"
            value={value.startDate}
            max={value.endDate || undefined}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            disabled={disabled}
            className="w-auto bg-surface tabular-nums"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="End date"
            value={value.endDate}
            min={value.startDate || undefined}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            disabled={disabled}
            className="w-auto bg-surface tabular-nums"
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

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="search" {...props} className={cn("w-full sm:w-56 bg-surface", props.className)} />;
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
    <form onSubmit={onSubmit} className="flat-card p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {children}
        <Button type="submit" loading={isLoading}>
          {!isLoading && <Filter className="w-4 h-4 mr-1.5" aria-hidden="true" />}
          {isLoading ? "Loading..." : "Apply"}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onExport} loading={isExporting} disabled={isLoading}>
          {!isExporting && <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />}
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()} disabled={isLoading}>
          <Printer className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Print
        </Button>
      </div>
    </form>
  );
}

export function ReportError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive p-4 text-sm font-medium">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ KPIs */

const TONES = {
  default: "text-foreground",
  success: "text-emerald-600",
  danger: "text-rose-600",
  warning: "text-amber-600",
  orange: "text-orange-600",
};
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
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", count >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
      {items
        ? items.map((k) => (
            <div key={k.label} className="flat-card p-4 sm:p-5 min-w-0">
              <p className="text-xs font-medium text-muted-foreground mb-1.5 truncate" title={k.hint ?? k.label}>
                {k.label}
              </p>
              <p className={cn("text-xl sm:text-2xl font-bold tracking-tight tabular-nums truncate", TONES[k.tone ?? "default"])}>
                {k.value}
              </p>
              {k.sub && <p className="text-xs text-muted-foreground mt-1 truncate">{k.sub}</p>}
            </div>
          ))
        : Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flat-card p-5">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-7 w-32" />
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
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Columns3 className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
        Columns
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-popover border border-border rounded-md z-20 p-1.5 text-sm animate-in fade-in">
          {columns.map((c) => (
            <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={visible[c.key]}
                onChange={() => onToggle(c.key)}
                className="accent-primary"
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
    <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 print:hidden">
      <p className="text-xs text-muted-foreground tabular-nums">
        Showing {from}–{to} of {meta.total}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPage(meta.page - 1)} disabled={disabled || meta.page <= 1}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {meta.page} / {Math.max(1, meta.totalPages)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
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
    <section className="flat-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <ColumnToggle columns={columns.map((c) => ({ key: c.key, label: c.label }))} visible={visible} onToggle={onToggle} />
      </div>
      <div className={cn("overflow-x-auto transition-opacity", isLoading && rows && "opacity-60")} aria-busy={isLoading}>
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-border bg-muted text-xs font-medium text-muted-foreground">
              {shown.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 font-medium", alignCls(c.align))}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!rows ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {shown.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, shown.length)} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={String(row._id ?? i)} className="hover:bg-muted/60 transition-colors">
                  {shown.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 tabular-nums", alignCls(c.align), c.className)}>
                      {c.render(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && <Pagination meta={pagination} onPage={onPage} disabled={isLoading} />}
    </section>
  );
}

/* ---------------------------------------------------------------- badges */

const BADGE_TONES = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export const PAYMENT_BADGE: Record<string, keyof typeof BADGE_TONES> = {
  CASH: "success",
  CARD: "info",
  UPI: "violet",
  OTHER: "warning",
};

/** Signed money cell: +₹10.00 in green, −₹4.00 in red. */
export function Signed({ value, format }: { value: number; format: (n: number) => string }) {
  const v = Number(value) || 0;
  return (
    <span className={cn("font-semibold", v < 0 ? "text-rose-600" : "text-emerald-600")}>
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
    const Swal = (await import("sweetalert2")).default;
    Swal.fire("Error", err.response?.data?.error || "Failed to export report", "error");
  }
}

export async function warn(message: string) {
  const Swal = (await import("sweetalert2")).default;
  Swal.fire("Check the filters", message, "warning");
}
