"use client";

import Swal from "@/lib/swal";
import { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, ChevronRight, Filter } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";
import { useCurrency } from "@/context/CurrencyContext";
import { colors, chartSeries, chartTheme } from "@/lib/design";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Chip, PageShell, StatCard } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ChartCard, ChartLegend, legendStyle } from "@/components/reports/ReportUI";

const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

// Payment methods and categories step down the chart series (Action Blue first, then the ink ladder)
const PAYMENT_COLORS: { [key: string]: string } = {
  CASH: chartSeries[0],
  CARD: chartSeries[1],
  UPI: chartSeries[2],
  OTHER: chartSeries[3],
};

const CATEGORY_COLORS = chartSeries;

const kpiLink = "press cursor-pointer block rounded-lg min-w-0";

export default function DashboardPage() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Draft Filters state
  const [dateRange, setDateRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Active Filters state
  const [activeFilters, setActiveFilters] = useState({
    dateRange: "today",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    // Abort the previous request so a slow, stale response can't overwrite newer filter results
    const controller = new AbortController();
    axios
      .get("/api/dashboard", {
        params: {
          dateRange: activeFilters.dateRange,
          startDate: activeFilters.startDate,
          endDate: activeFilters.endDate,
        },
        signal: controller.signal,
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error("Failed to load dashboard data", err);
        Swal.fire("Error", err.response?.data?.error || "Failed to load dashboard metrics", "error");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [activeFilters]);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (dateRange === "custom" && (!startDate || !endDate)) {
      Swal.fire(
        "Warning",
        "Please select both start date and end date for custom date range.",
        "warning",
      );
      return;
    }

    setIsLoading(true);
    setActiveFilters({
      dateRange,
      startDate,
      endDate,
    });
  };

  return (
    <PageShell className="relative min-h-[600px]">
      <PageHeader
        title="Pharmacy Executive Overview"
        description="Real-time store sales, inventory valuation, and cash flow analysis."
      />

      {/* Global filter bar (floating-sticky-bar under the 44px global nav) */}
      <form
        onSubmit={handleApplyFilter}
        className="frosted sticky top-11 z-20 border border-hairline rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:static"
      >
        <div role="group" aria-label="Date range" className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((r) => (
            <Chip
              key={r.value}
              selected={dateRange === r.value}
              onClick={() => setDateRange(r.value)}
              disabled={isLoading}
            >
              {r.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Date Pickers */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
              <Input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isLoading}
                className="w-auto tabular"
              />
              <span className="text-caption text-ink-48">to</span>
              <Input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isLoading}
                className="w-auto tabular"
              />
            </div>
          )}

          <Button type="submit" loading={isLoading}>
            {!isLoading && <Filter aria-hidden="true" />}
            {isLoading ? "Applying Filters..." : "Apply Filter"}
          </Button>
        </div>
      </form>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Spinner className="size-10" />
        </div>
      )}

      {/* Dashboard Main Content */}
      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <Link href="/dashboard/reports/sales" className={kpiLink}>
              <StatCard label="Today's Sales" value={formatCurrency(data.metrics.todaySales)} className="h-full" />
            </Link>
            <Link href="/dashboard/reports/profit-loss" className={kpiLink}>
              <StatCard label="Monthly Profit" value={formatCurrency(data.metrics.monthlyProfit)} className="h-full" />
            </Link>
            <Link href="/dashboard/reports/inventory-value" className={kpiLink}>
              <StatCard label="Inventory Value" value={formatCurrency(data.metrics.inventoryValue)} className="h-full" />
            </Link>
            <Link href="/dashboard/inventory/alerts" className={kpiLink}>
              <StatCard
                label="Low Stock Alerts"
                value={data.metrics.lowStockCount}
                tone={data.metrics.lowStockCount > 0 ? "destructive" : "default"}
                className="h-full"
              />
            </Link>
            <Link href="/dashboard/reports/expiry" className={kpiLink}>
              <StatCard
                label="Expiring Soon (30d)"
                value={data.metrics.expiringSoonCount}
                tone={data.metrics.expiringSoonCount > 0 ? "warning" : "default"}
                className="h-full"
              />
            </Link>
          </div>

          {/* Row 1: Revenue & Profit trend + Payment method breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ChartCard
              className="lg:col-span-2"
              title={`Sales Revenue vs Net Profit (${currencySymbol})`}
              legend={
                <ChartLegend
                  items={[
                    { label: "Revenue", color: chartSeries[0] },
                    { label: "Net Profit", color: chartSeries[1] },
                  ]}
                />
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid {...chartTheme.grid} vertical={false} />
                  <XAxis dataKey="date" tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartTheme.axisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${currencySymbol}${val}`}
                  />
                  <RechartsTooltip {...chartTheme.tooltip} formatter={(val: any) => formatCurrency(val)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={chartSeries[0]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Net Profit"
                    stroke={chartSeries[1]}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Revenue by Payment Method">
              {data.paymentMethods.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="revenue"
                      nameKey="method"
                    >
                      {data.paymentMethods.map((entry: any) => (
                        <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] || colors.ink80} />
                      ))}
                    </Pie>
                    <RechartsTooltip {...chartTheme.tooltip} formatter={(val: any) => formatCurrency(val)} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Row 2: Peak hours + Category sales + Top selling medicines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ChartCard title="Peak Pharmacy Rush Hours" height="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid {...chartTheme.grid} vertical={false} />
                  <XAxis dataKey="hour" tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={chartTheme.axisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${currencySymbol}${val}`}
                  />
                  <RechartsTooltip {...chartTheme.tooltip} formatter={(val: any) => formatCurrency(val)} />
                  <Bar dataKey="revenue" name="Hourly Revenue" fill={chartSeries[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sales by Medicine Category" height="h-64">
              {data.categoryBreakdown.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="revenue"
                      nameKey="name"
                    >
                      {data.categoryBreakdown.map((entry: any, index: number) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip {...chartTheme.tooltip} formatter={(val: any) => formatCurrency(val)} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Leaderboard: Top Selling Products */}
            <Card className="p-6 min-w-0 break-inside-avoid">
              <div className="flex justify-between items-center gap-3 mb-4">
                <h3 className="text-tagline text-ink">Top Selling Medicines</h3>
                <Link
                  href="/dashboard/reports/fast-moving"
                  className="text-link inline-flex items-center gap-0.5 text-caption shrink-0"
                >
                  View Ranking
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="text-caption text-ink-48 py-8 text-center">No sales recorded for this period.</p>
              ) : (
                <ul className="divide-y divide-divider-soft text-caption">
                  {data.topProducts.map((product: any, idx: number) => (
                    <li key={product._id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-ink-48 tabular w-6 shrink-0">#{idx + 1}</span>
                        <span className="text-ink truncate">{product.name}</span>
                      </div>
                      <div className="text-right tabular shrink-0">
                        <span className="text-ink font-semibold">{formatCurrency(product.revenue)}</span>
                        <span className="text-ink-48 text-fine-print block mt-0.5">{product.qty_sold} sold</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center rounded-sm bg-parchment text-caption text-ink-48">
      No sales recorded for this period.
    </div>
  );
}
