"use client";

import {
  ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useCurrency } from "@/context/CurrencyContext";
import { CHART, ChartCard, ChartLegend, axisTick, compact, legendStyle, shortDate, tooltipStyle } from "@/components/reports/ReportUI";

const WATERFALL_COLORS = [CHART.primary, CHART.warning, CHART.danger, CHART.success];

export default function ProfitLossCharts({ charts }: { charts: any }) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const money = (v: any) => formatCurrency(v);
  const moneyTick = (v: number) => `${currencySymbol}${compact(v)}`;
  const hasSales = charts.dailyProfitTrend.some((d: any) => d.revenue !== 0 || d.cogs !== 0);
  // A pie can't show negative slices (loss-making categories); those still appear in the table
  const categoryProfit = charts.categoryProfit.filter((c: any) => c.profit > 0);
  const waterfall = charts.waterfall.map((w: any, i: number) => ({ ...w, fill: WATERFALL_COLORS[i % WATERFALL_COLORS.length] }));
  const hasDiscounts = charts.discountBreakdown.some((d: any) => d.amount > 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          className="lg:col-span-2"
          title={`Daily Revenue, COGS & Profit (${currencySymbol})`}
          isEmpty={!hasSales}
          legend={
            <ChartLegend
              items={[
                { label: "Revenue", color: CHART.primary },
                { label: "COGS", color: CHART.danger, dashed: true },
                { label: "Profit", color: CHART.success },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={charts.dailyProfitTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="plRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.primary} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="plProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={money} />
              <Area isAnimationActive={false} type="monotone" dataKey="revenue" name="Revenue" stroke={CHART.primary} fill="url(#plRev)" strokeWidth={2} />
              <Line isAnimationActive={false} type="monotone" dataKey="cogs" name="COGS" stroke={CHART.danger} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" name="Net Profit" stroke={CHART.success} fill="url(#plProf)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Profit Share by Category" isEmpty={categoryProfit.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={categoryProfit} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="profit" nameKey="name">
                {categoryProfit.map((e: any, i: number) => (
                  <Cell key={e.name} fill={CHART.categorical[i % CHART.categorical.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={money} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Top 5 Most Profitable Medicines" height="h-64" isEmpty={charts.topProfitableProducts.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topProfitableProducts} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <YAxis dataKey="name" type="category" width={100} tick={{ ...axisTick, fill: CHART.primary }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="profit" name="Net Profit" fill={CHART.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="P&L Breakdown" height="h-64" isEmpty={!hasSales}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfall} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="category" tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                {waterfall.map((e: any) => (
                  <Cell key={e.category} fill={e.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={`Discounts Given (${currencySymbol})`} height="h-64" isEmpty={!hasDiscounts}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.discountBreakdown} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="amount" name="Discount" fill={CHART.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
