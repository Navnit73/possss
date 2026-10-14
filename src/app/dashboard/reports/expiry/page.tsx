"use client";

import { useState } from "react";
import { downloadCSV } from "@/lib/reports/csv";
import { useCurrency } from "@/context/CurrencyContext";
import { Select } from "@/components/ui/Select";
import {
  KpiGrid, ReportColumn, ReportError, ReportFilterBar, ReportTable, SearchInput, StatusBadge, runExport, useColumns, useReportData,
} from "@/components/reports/ReportUI";

const API = "/api/reports/expiry";
const LIMIT = 20;
const COLUMN_KEYS = [
  "product_name", "batch_number", "supplier_name", "qty_available", "cost_price", "purchase_value_loss", "expiry_date", "status",
] as const;
type Col = (typeof COLUMN_KEYS)[number];

const STATUS_TONE: Record<string, "danger" | "orange" | "warning" | "neutral"> = {
  Expired: "danger",
  "30 Days": "orange",
  "60 Days": "warning",
  "90 Days": "neutral",
};

const INITIAL = { status: "all", search: "" };

export default function ExpiryReportPage() {
  const { formatCurrency } = useCurrency();
  const [draft, setDraft] = useState(INITIAL);
  const [filters, setFilters] = useState(INITIAL);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const { visible, toggle } = useColumns(COLUMN_KEYS);
  const { data, isLoading, error } = useReportData(API, { ...filters, page, limit: LIMIT });

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
          Batch: r.batch_number,
          Supplier: r.supplier_name,
          Qty: r.qty_available,
          "Cost Price": r.cost_price,
          "Value at Risk": r.purchase_value_loss,
          "Expiry Date": r.expiry_date,
          Status: r.status,
        })),
        "Expiry_Report",
      ),
    );
    setIsExporting(false);
  };

  const m = data?.metrics;
  const columns: ReportColumn<any, Col>[] = [
    { key: "product_name", label: "Product", className: "font-semibold text-ink", render: (r) => r.product_name },
    { key: "batch_number", label: "Batch", className: "text-ink-48", render: (r) => r.batch_number },
    { key: "supplier_name", label: "Supplier", className: "text-ink-48 max-w-[180px] truncate", render: (r) => r.supplier_name },
    { key: "qty_available", label: "Qty", align: "right", className: "font-semibold", render: (r) => r.qty_available },
    { key: "cost_price", label: "Cost", align: "right", render: (r) => formatCurrency(r.cost_price) },
    { key: "purchase_value_loss", label: "Value at Risk", align: "right", className: "font-semibold text-destructive", render: (r) => formatCurrency(r.purchase_value_loss) },
    { key: "expiry_date", label: "Expiry Date", className: "text-ink-48", render: (r) => r.expiry_date },
    { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge> },
  ];

  return (
    <div className="space-y-8">
      <ReportFilterBar onSubmit={apply} isLoading={isLoading} onExport={exportCsv} isExporting={isExporting}>
        <Select
          aria-label="Expiry status"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          disabled={isLoading}
          className="w-auto min-w-[200px]"
        >
          <option value="all">All At Risk (≤ 90 Days)</option>
          <option value="expired">Already Expired</option>
          <option value="30days">Expires in 30 Days</option>
          <option value="60days">Expires in 31–60 Days</option>
          <option value="90days">Expires in 61–90 Days</option>
        </Select>
        <SearchInput
          placeholder="Search product or batch..."
          aria-label="Search product or batch"
          value={draft.search}
          onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          disabled={isLoading}
        />
      </ReportFilterBar>

      <ReportError message={error} />

      <div className={isLoading && m ? "opacity-60 transition-opacity" : undefined}>
        <KpiGrid
          items={
            m && [
              { label: "Expired", value: `${m.expired_count} batches`, tone: "danger", sub: `${formatCurrency(m.expired_value)} at cost` },
              { label: "Expiring in 30 Days", value: `${m.days30_count} batches`, tone: "orange" },
              { label: "Expiring in 31–60 Days", value: `${m.days60_count} batches`, tone: "warning" },
              { label: "Expiring in 61–90 Days", value: `${m.days90_count} batches` },
            ]
          }
        />
      </div>

      <ReportTable
        title="At-Risk Batches"
        columns={columns}
        visible={visible}
        onToggle={toggle}
        rows={data?.table?.data ?? null}
        pagination={data?.table?.pagination ?? null}
        onPage={setPage}
        isLoading={isLoading}
        emptyText="No expiring batches match these filters."
      />
    </div>
  );
}
