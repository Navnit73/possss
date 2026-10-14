"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { downloadCSV } from "@/lib/reports/csv";
import { useCurrency } from "@/context/CurrencyContext";
import {
  ChartsSkeleton, DateFilter, DateRangeFilter, KpiGrid, ReportColumn, ReportError, ReportFilterBar, ReportTable,
  SearchInput, Signed, runExport, useColumns, useReportData, validateDateFilter, warn,
} from "@/components/reports/ReportUI";

const ProfitLossCharts = dynamic(() => import("./ProfitLossCharts"), { ssr: false, loading: () => <ChartsSkeleton rows={[3, 3]} /> });

const API = "/api/reports/profit-loss";
const LIMIT = 20;
const COLUMN_KEYS = ["product_name", "category", "qty_sold", "total_cost", "total_revenue", "profit", "margin_pct"] as const;
type Col = (typeof COLUMN_KEYS)[number];

interface Filters extends DateFilter {
  search: string;
}
const INITIAL: Filters = { dateRange: "30days", startDate: "", endDate: "", search: "" };

export default function ProfitLossReportPage() {
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
        rows.map((r) => ({
          Product: r.product_name,
          Category: r.category,
          "Qty Sold": r.qty_sold,
          "Total Cost": r.total_cost,
          "Total Revenue": r.total_revenue,
          Profit: r.profit,
          "Margin %": r.margin_pct,
        })),
        "Profit_Loss_Report",
      ),
    );
    setIsExporting(false);
  };

  const m = data?.metrics;
  const columns: ReportColumn<any, Col>[] = [
    { key: "product_name", label: "Product", className: "font-medium text-foreground", render: (r) => r.product_name },
    { key: "category", label: "Category", className: "text-muted-foreground", render: (r) => r.category },
    { key: "qty_sold", label: "Qty Sold", align: "right", render: (r) => r.qty_sold },
    { key: "total_cost", label: "Cost", align: "right", render: (r) => formatCurrency(r.total_cost) },
    { key: "total_revenue", label: "Revenue", align: "right", render: (r) => formatCurrency(r.total_revenue) },
    { key: "profit", label: "Profit", align: "right", render: (r) => <Signed value={r.profit} format={formatCurrency} /> },
    {
      key: "margin_pct",
      label: "Margin",
      align: "right",
      render: (r) => <span className={(r.margin_pct ?? 0) < 0 ? "font-semibold text-rose-600" : "font-semibold"}>{Number(r.margin_pct ?? 0).toFixed(1)}%</span>,
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
          count={5}
          items={
            m && [
              { label: "Net Revenue", hint: "After item and invoice discounts, excluding tax", value: formatCurrency(m.gross_revenue) },
              { label: "Product Cost (COGS)", value: formatCurrency(m.product_cost) },
              { label: "Gross Profit", value: formatCurrency(m.gross_profit), tone: m.gross_profit >= 0 ? "success" : "danger" },
              { label: "Profit Margin", value: `${Number(m.margin_pct ?? 0).toFixed(1)}%`, tone: m.margin_pct >= 0 ? "default" : "danger" },
              { label: "Total Discounts", value: formatCurrency(m.discounts_given), tone: "warning" },
            ]
          }
        />
        {data ? <ProfitLossCharts charts={data.charts} /> : !error && <ChartsSkeleton rows={[3, 3]} />}
      </div>

      <ReportTable
        title="Product Profitability"
        columns={columns}
        visible={visible}
        onToggle={toggle}
        rows={data?.table?.data ?? null}
        pagination={data?.table?.pagination ?? null}
        onPage={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
