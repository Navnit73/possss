"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CHART, ChartCard, axisTick, compact, legendStyle, tooltipStyle } from "@/components/reports/ReportUI";

const units = (v: any) => `${Number(v).toLocaleString()} units`;

export default function FastMovingCharts({ charts }: { charts: any }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard className="lg:col-span-2" title="Top Fast-Selling Medicines (Units Sold)" isEmpty={charts.topUnits.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topUnits} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compact} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={120} tick={{ ...axisTick, fill: CHART.primary }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={units} cursor={{ fill: "#F1F5F9" }} />
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
              <Tooltip contentStyle={tooltipStyle} formatter={units} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {charts.atRiskStockouts.length > 0 && (
        <ChartCard title="Fast Sellers at Risk of Stockout (< 14 days of stock left)" height="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.atRiskStockouts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
              <YAxis width={40} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)} days`} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="days_left" name="Days of Stock Left" fill={CHART.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </>
  );
}
