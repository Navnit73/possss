"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { downloadCSV } from "@/lib/reports/csv";
import { useCurrency } from "@/context/CurrencyContext";
import { Select } from "@/components/ui/Select";
import {
  ChartsSkeleton, DateFilter, DateRangeFilter, KpiGrid, PAYMENT_BADGE, ReportColumn, ReportError, ReportFilterBar,
  ReportTable, SearchInput, Signed, StatusBadge, runExport, useColumns, useReportData, validateDateFilter, warn,
} from "@/components/reports/ReportUI";

// recharts is large: load it after the KPIs and table so the page is usable sooner
const SalesCharts = dynamic(() => import("./SalesCharts"), { ssr: false, loading: () => <ChartsSkeleton rows={[2, 2, 3]} /> });

const API = "/api/reports/sales";
const LIMIT = 20;
const COLUMN_KEYS = ["invoice_no", "created_at", "product_name", "batch_number", "qty", "price", "profit", "payment_method"] as const;
type Col = (typeof COLUMN_KEYS)[number];

interface Filters extends DateFilter {
  search: string;
  paymentMethod: string;
}
const INITIAL: Filters = { dateRange: "30days", startDate: "", endDate: "", search: "", paymentMethod: "" };

export default function SalesReportPage() {
  const { formatCurrency } = useCurrency();
  const [draft, setDraft] = useState<Filters>(INITIAL);
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const { visible, toggle } = useColumns(COLUMN_KEYS);

  // Charts / KPIs only re-run when filters change; paging only fetches the register
  const summary = useReportData(API, { ...filters, section: "summary" });
  const table = useReportData(API, { ...filters, section: "table", page, limit: LIMIT });
  const isLoading = summary.isLoading || table.isLoading;

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
          "Invoice No": r.invoice_no,
          Date: new Date(r.created_at).toLocaleString(),
          Product: r.product_name,
          Batch: r.batch_number,
          Qty: r.qty,
          Price: r.price,
          "Item Discount %": r.item_discount,
          Profit: r.profit,
          Payment: r.payment_method,
        })),
        "Sales_Report",
      ),
    );
    setIsExporting(false);
  };

  const m = summary.data?.metrics;
  const columns: ReportColumn<any, Col>[] = [
    { key: "invoice_no", label: "Invoice No", className: "font-semibold text-foreground", render: (r) => r.invoice_no },
    { key: "created_at", label: "Date", className: "text-muted-foreground", render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "product_name", label: "Product", className: "font-medium text-foreground", render: (r) => r.product_name },
    { key: "batch_number", label: "Batch", className: "text-muted-foreground", render: (r) => r.batch_number },
    { key: "qty", label: "Qty", align: "right", render: (r) => r.qty },
    { key: "price", label: "Price", align: "right", render: (r) => formatCurrency(r.price) },
    { key: "profit", label: "Profit", align: "right", render: (r) => <Signed value={r.profit} format={formatCurrency} /> },
    {
      key: "payment_method",
      label: "Payment",
      align: "center",
      render: (r) => <StatusBadge tone={PAYMENT_BADGE[r.payment_method] ?? "neutral"}>{r.payment_method || "OTHER"}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFilterBar onSubmit={apply} isLoading={isLoading} onExport={exportCsv} isExporting={isExporting}>
        <DateRangeFilter value={draft} onChange={(v) => setDraft({ ...draft, ...v })} disabled={isLoading} />
        <Select
          aria-label="Payment method"
          value={draft.paymentMethod}
          onChange={(e) => setDraft({ ...draft, paymentMethod: e.target.value })}
          disabled={isLoading}
          className="w-auto min-w-[140px] bg-surface"
        >
          <option value="">All Payments</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="UPI">UPI</option>
          <option value="OTHER">Other</option>
        </Select>
        <SearchInput
          placeholder="Search invoice no..."
          aria-label="Search invoice number"
          value={draft.search}
          onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          disabled={isLoading}
        />
      </ReportFilterBar>

      <ReportError message={summary.error || table.error} />

      <div className={summary.isLoading && m ? "opacity-60 transition-opacity space-y-6" : "space-y-6"}>
        <KpiGrid
          items={
            m && [
              { label: "Total Sales (incl. tax)", hint: "Invoice totals collected, including tax", value: formatCurrency(m.totalRevenue) },
              { label: "Total Orders", value: m.totalOrders.toLocaleString() },
              { label: "Items Sold", value: m.totalQtySold.toLocaleString() },
              { label: "Avg Order Value", value: formatCurrency(m.avgOrderValue) },
            ]
          }
        />
        {summary.data ? <SalesCharts charts={summary.data.charts} /> : !summary.error && <ChartsSkeleton rows={[2, 2, 3]} />}
      </div>

      <ReportTable
        title="Sales Register"
        columns={columns}
        visible={visible}
        onToggle={toggle}
        rows={table.data?.table?.data ?? null}
        pagination={table.data?.table?.pagination ?? null}
        onPage={setPage}
        isLoading={table.isLoading}
      />
    </div>
  );
}
