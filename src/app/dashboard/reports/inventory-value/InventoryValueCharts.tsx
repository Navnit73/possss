"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { chartTheme, colors } from "@/lib/design";
import { useCurrency } from "@/context/CurrencyContext";
import { CHART, ChartCard, ChartLegend, axisTick, compact, legendStyle } from "@/components/reports/ReportUI";

export default function InventoryValueCharts({ charts }: { charts: any }) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const money = (v: any) => formatCurrency(v);
  const moneyTick = (v: number) => `${currencySymbol}${compact(v)}`;
  const categoryValue = charts.categoryValue.filter((c: any) => c.cost_value > 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Stock Value Share by Category" isEmpty={categoryValue.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={categoryValue} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="cost_value" nameKey="name">
                {categoryValue.map((e: any, i: number) => (
                  <Cell key={e.name} fill={CHART.categorical[i % CHART.categorical.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTheme.tooltip} formatter={money} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title={`Cost Value vs Expected Retail Value (${currencySymbol})`}
          isEmpty={charts.categoryValue.length === 0}
          legend={<ChartLegend items={[{ label: "Purchase Cost", color: CHART.primary }, { label: "Retail Value", color: CHART.success }]} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.categoryValue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip {...chartTheme.tooltip} formatter={money} />
              <Bar isAnimationActive={false} dataKey="cost_value" name="Purchase Cost" fill={CHART.primary} radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="selling_value" name="Retail Value" fill={CHART.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top 5 Highest Stock Value Medicines" height="h-64" isEmpty={charts.topValuedProducts.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topValuedProducts} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <YAxis dataKey="name" type="category" width={110} tick={{ ...axisTick, fill: colors.ink }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltip} formatter={money} />
              <Bar isAnimationActive={false} dataKey="value" name="Stock Value" fill={CHART.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock Quantity by Rack" height="h-64" isEmpty={charts.rackDistribution.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.rackDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} vertical={false} />
              <XAxis dataKey="rack" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} allowDecimals={false} />
              <Tooltip {...chartTheme.tooltip} formatter={(v: any) => `${Number(v).toLocaleString()} units`} />
              <Bar isAnimationActive={false} dataKey="qty" name="Stock Qty" fill={CHART.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
