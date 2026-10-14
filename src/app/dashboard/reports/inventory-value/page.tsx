"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { downloadCSV } from "@/lib/reports/csv";
import { useCurrency } from "@/context/CurrencyContext";
import { Select } from "@/components/ui/Select";
import {
  ChartsSkeleton, KpiGrid, ReportColumn, ReportError, ReportFilterBar, ReportTable, SearchInput, StatusBadge,
  runExport, useColumns, useReportData,
} from "@/components/reports/ReportUI";

const InventoryValueCharts = dynamic(() => import("./InventoryValueCharts"), { ssr: false, loading: () => <ChartsSkeleton rows={[3, 2]} /> });

const API = "/api/reports/inventory-value";
const LIMIT = 20;
const COLUMN_KEYS = [
  "product_name", "category", "batch_number", "rack_location", "qty_available", "cost_price", "selling_price", "total_cost_value", "expiry_date",
] as const;
type Col = (typeof COLUMN_KEYS)[number];

const INITIAL = { search: "", category: "" };

export default function InventoryValueReportPage() {
  const { formatCurrency } = useCurrency();
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [draft, setDraft] = useState(INITIAL);
  const [filters, setFilters] = useState(INITIAL);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const { visible, toggle } = useColumns(COLUMN_KEYS);
  // KPIs / charts only re-run when filters change; paging only fetches the table
  const summary = useReportData(API, { ...filters, section: "summary" });
  const table = useReportData(API, { ...filters, section: "table", page, limit: LIMIT });
  const isLoading = summary.isLoading || table.isLoading;
  const data = summary.data;

  useEffect(() => {
    axios
      .get("/api/categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Failed to load categories", err)); // filter still works without the list
  }, []);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
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
          Batch: r.batch_number,
          Rack: r.rack_location,
          "Qty Available": r.qty_available,
          "Cost Price": r.cost_price,
          "Selling Price": r.selling_price,
          "Total Cost Value": r.total_cost_value,
          "Expected Revenue": r.expected_revenue,
          "Expiry Date": r.expiry_date || "N/A",
        })),
        "Inventory_Value_Report",
      ),
    );
    setIsExporting(false);
  };

  const m = data?.metrics;
  const columns: ReportColumn<any, Col>[] = [
    { key: "product_name", label: "Product", className: "font-semibold text-ink", render: (r) => r.product_name },
    { key: "category", label: "Category", className: "text-ink-48", render: (r) => r.category },
    { key: "batch_number", label: "Batch", className: "text-ink-48", render: (r) => r.batch_number },
    { key: "rack_location", label: "Rack", className: "text-ink-48", render: (r) => r.rack_location },
    { key: "qty_available", label: "Available Qty", align: "right", className: "font-semibold", render: (r) => r.qty_available },
    { key: "cost_price", label: "Cost Price", align: "right", render: (r) => formatCurrency(r.cost_price) },
    { key: "selling_price", label: "Selling Price", align: "right", render: (r) => formatCurrency(r.selling_price) },
    { key: "total_cost_value", label: "Total Cost Value", align: "right", className: "font-semibold", render: (r) => formatCurrency(r.total_cost_value) },
    {
      key: "expiry_date",
      label: "Expiry Date",
      className: "text-ink-48",
      // "yyyy-MM-dd" calendar date: shown as-is (new Date() would parse it as UTC and can show the previous day)
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.expiry_date || "N/A"}
          {r.is_expired && <StatusBadge tone="danger">Expired</StatusBadge>}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <ReportFilterBar onSubmit={apply} isLoading={isLoading} onExport={exportCsv} isExporting={isExporting}>
        <Select
          aria-label="Category"
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          disabled={isLoading}
          className="w-auto min-w-[170px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
        <SearchInput
          placeholder="Search product or batch..."
          aria-label="Search product or batch"
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
              { label: "Unique Products", value: m.total_products.toLocaleString() },
              { label: "Total Stock Qty", value: m.total_stock_qty.toLocaleString() },
              {
                label: "Inventory Value (Cost)",
                value: formatCurrency(m.purchase_value),
                sub: m.expired_value > 0 ? `incl. ${formatCurrency(m.expired_value)} expired` : undefined,
              },
              { label: "Expected Profit", hint: "Sellable (non-expired) stock at selling price minus cost", value: formatCurrency(m.expected_profit), tone: m.expected_profit >= 0 ? "success" : "danger" },
            ]
          }
        />
        {data ? <InventoryValueCharts charts={data.charts} /> : !summary.error && <ChartsSkeleton rows={[3, 2]} />}
      </div>

      <ReportTable
        title="Current Stock Valuation"
        columns={columns}
        visible={visible}
        onToggle={toggle}
        rows={table.data?.table?.data ?? null}
        pagination={table.data?.table?.pagination ?? null}
        onPage={setPage}
        isLoading={table.isLoading}
        emptyText="No stock found for the selected filters."
      />
    </div>
  );
}
