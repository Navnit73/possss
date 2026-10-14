"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { downloadCSV } from "@/lib/reports/csv";
import { useCurrency } from "@/context/CurrencyContext";
import {
  ChartsSkeleton, DateFilter, DateRangeFilter, KpiGrid, ReportColumn, ReportError, ReportFilterBar, ReportTable,
  SearchInput, Signed, runExport, useColumns, useReportData, validateDateFilter, warn,
} from "@/components/reports/ReportUI";

const FastMovingCharts = dynamic(() => import("./FastMovingCharts"), { ssr: false, loading: () => <ChartsSkeleton rows={[3]} /> });

const API = "/api/reports/fast-moving";
const LIMIT = 20;
/** Sentinel the API uses for "no sales in the period" (stock lasts indefinitely). */
const NO_SALES_DAYS = 9999;
const COLUMN_KEYS = [
  "rank", "product_name", "category", "qty_sold", "revenue_generated", "profit_generated", "avg_daily_sales", "current_stock", "estimated_stock_days",
] as const;
type Col = (typeof COLUMN_KEYS)[number];

interface Filters extends DateFilter {
  search: string;
}
const INITIAL: Filters = { dateRange: "30days", startDate: "", endDate: "", search: "" };

const fmtDays = (d: unknown) => (d === NO_SALES_DAYS || d == null ? "∞" : Number(d).toFixed(0));

export default function FastMovingReportPage() {
  const { formatCurrency } = useCurrency();
  const [draft, setDraft] = useState<Filters>(INITIAL);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const { visible, toggle } = useColumns(COLUMN_KEYS);
  const { data, isLoading, error } = useReportData(API, { ...filters, page, limit: LIMIT });

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validateDateFilter(draft);
    if (msg) return void warn(msg);
    setPage(1);
    setFilters({ ...draft, search: draft.search.trim() });
  };

  const exportCsv = async () => {
    setIsExporting(true);
    await runExport(API, filters, (rows) =>
      downloadCSV(
        rows.map((r, i) => ({
          Rank: i + 1,
          Product: r.product_name,
          Category: r.category,
          "Qty Sold": r.qty_sold,
          "Revenue Generated": r.revenue_generated,
          "Profit Generated": r.profit_generated,
          "Avg Daily Sales": r.avg_daily_sales,
          "Current Stock": r.current_stock,
          "Estimated Stock Days": fmtDays(r.estimated_stock_days),
        })),
        "Fast_Moving_Products",
      ),
    );
    setIsExporting(false);
  };

  const m = data?.metrics;
  const pg = data?.table?.pagination;
  const columns: ReportColumn<any, Col>[] = [
    { key: "rank", label: "#", align: "center", className: "text-muted-foreground w-12", render: (_r, i) => (pg ? (pg.page - 1) * pg.limit + i + 1 : i + 1) },
    { key: "product_name", label: "Product", className: "font-medium text-foreground", render: (r) => r.product_name },
    { key: "category", label: "Category", className: "text-muted-foreground", render: (r) => r.category },
    { key: "qty_sold", label: "Units Sold", align: "right", className: "font-semibold", render: (r) => r.qty_sold },
    { key: "revenue_generated", label: "Revenue", align: "right", render: (r) => formatCurrency(r.revenue_generated) },
    { key: "profit_generated", label: "Profit", align: "right", render: (r) => <Signed value={r.profit_generated} format={formatCurrency} /> },
    { key: "avg_daily_sales", label: "Avg / Day", align: "right", render: (r) => Number(r.avg_daily_sales ?? 0).toFixed(1) },
    { key: "current_stock", label: "Stock", align: "right", render: (r) => r.current_stock },
    {
      key: "estimated_stock_days",
      label: "Est. Days Left",
      align: "right",
      render: (r) => {
        const d = r.estimated_stock_days;
        if (d === NO_SALES_DAYS || d == null) return <span className="text-muted-foreground">∞</span>;
        return <span className={d < 7 ? "font-semibold text-rose-600" : d < 14 ? "font-semibold text-amber-600" : undefined}>{fmtDays(d)} days</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFilterBar onSubmit={apply} isLoading={isLoading} onExport={exportCsv} isExporting={isExporting}>
        <DateRangeFilter value={draft} onChange={(v) => setDraft({ ...draft, ...v })} disabled={isLoading} />
        <SearchInput
          placeholder="Search product..."
          aria-label="Search product"
          value={draft.search}
          onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          disabled={isLoading}
        />
      </ReportFilterBar>

      <ReportError message={error} />

      <div className={isLoading && m ? "opacity-60 transition-opacity space-y-6" : "space-y-6"}>
        <KpiGrid
          items={
            m && [
              { label: "#1 Fast-Selling Product", value: <span className="text-lg sm:text-xl">{m.topPerformers?.[0] || "N/A"}</span> },
              { label: "Products Sold", value: Number(m.totalAnalyzed ?? 0).toLocaleString() },
              { label: "Stockout Risk (< 14 days)", value: m.atRiskCount, tone: m.atRiskCount > 0 ? "danger" : "success" },
              { label: "Ranked By", value: <span className="text-lg sm:text-xl">Units Sold</span> },
            ]
          }
        />
        {data ? <FastMovingCharts charts={data.charts} /> : !error && <ChartsSkeleton rows={[3]} />}
      </div>

      <ReportTable
        title="Fast-Moving Products Ranking"
        columns={columns}
        visible={visible}
        onToggle={toggle}
        rows={data?.table?.data ?? null}
        pagination={pg ?? null}
        onPage={setPage}
        isLoading={isLoading}
        emptyText="No sales found for this period."
      />
    </div>
  );
}
