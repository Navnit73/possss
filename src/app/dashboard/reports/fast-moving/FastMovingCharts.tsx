"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CHART, ChartCard, axisTick, compact, legendStyle } from "@/components/reports/ReportUI";
import { chartTheme, colors } from "@/lib/design";

const units = (v: any) => `${Number(v).toLocaleString()} units`;

export default function FastMovingCharts({ charts }: { charts: any }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard className="lg:col-span-2" title="Top Fast-Selling Medicines (Units Sold)" isEmpty={charts.topUnits.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topUnits} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={120} tick={{ ...axisTick, fill: colors.ink }} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltip} formatter={units} />
              <Bar isAnimationActive={false} dataKey="qty_sold" name="Units Sold" fill={CHART.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Units Sold by Category" isEmpty={charts.categoryVelocity.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={charts.categoryVelocity} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="qty" nameKey="name">
                {charts.categoryVelocity.map((e: any, i: number) => (
                  <Cell key={e.name} fill={CHART.categorical[i % CHART.categorical.length]} />
                ))}
              </Pie>
              <Tooltip {...chartTheme.tooltip} formatter={units} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {charts.atRiskStockouts.length > 0 && (
        <ChartCard title="Fast Sellers at Risk of Stockout (< 14 days of stock left)" height="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.atRiskStockouts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <YAxis width={40} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip {...chartTheme.tooltip} formatter={(v: any) => `${Number(v).toFixed(1)} days`} />
              <Bar isAnimationActive={false} dataKey="days_left" name="Days of Stock Left" fill={CHART.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}
