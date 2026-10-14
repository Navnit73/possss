"use client";

import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useCurrency } from "@/context/CurrencyContext";
import {
  CHART, PAYMENT_COLORS, ChartCard, ChartLegend, axisTick, compact, legendStyle, shortDate, tooltipStyle,
} from "@/components/reports/ReportUI";

const CUSTOMER_COLORS = [CHART.primary, CHART.axis];

export default function SalesCharts({ charts }: { charts: any }) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const money = (v: any) => formatCurrency(v);
  const moneyTick = (v: number) => `${currencySymbol}${compact(v)}`;
  const hasSales = charts.dailyTrend.some((d: any) => d.revenue !== 0);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          className="lg:col-span-2"
          title="Daily Sales by Payment Method"
          isEmpty={!hasSales}
          legend={
            <ChartLegend
              items={[
                { label: "Total", color: CHART.primary },
                { label: "Cash", color: PAYMENT_COLORS.CASH },
                { label: "Card", color: PAYMENT_COLORS.CARD },
                { label: "UPI", color: PAYMENT_COLORS.UPI },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.dailyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={money} />
              <Line isAnimationActive={false} type="monotone" dataKey="revenue" name="Total" stroke={CHART.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="cash" name="Cash" stroke={PAYMENT_COLORS.CASH} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              <Line isAnimationActive={false} type="monotone" dataKey="card" name="Card" stroke={PAYMENT_COLORS.CARD} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              <Line isAnimationActive={false} type="monotone" dataKey="upi" name="UPI" stroke={PAYMENT_COLORS.UPI} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by Payment Method" isEmpty={charts.paymentMethods.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={charts.paymentMethods} innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="revenue" nameKey="method">
                {charts.paymentMethods.map((e: any) => (
                  <Cell key={e.method} fill={PAYMENT_COLORS[e.method] || CHART.warning} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={money} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title={`Revenue vs Net Profit (${currencySymbol})`}
          height="h-64"
          isEmpty={!hasSales}
          legend={<ChartLegend items={[{ label: "Revenue", color: CHART.primary }, { label: "Profit", color: CHART.success }]} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts.dailyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.primary} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="salesProf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} formatter={money} />
              <Area isAnimationActive={false} type="monotone" dataKey="revenue" name="Revenue" stroke={CHART.primary} fill="url(#salesRev)" strokeWidth={2} />
              <Area isAnimationActive={false} type="monotone" dataKey="profit" name="Net Profit" stroke={CHART.success} fill="url(#salesProf)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Peak Hours (Hourly Sales)" height="h-64" isEmpty={!hasSales}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.hourlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="hour" tick={axisTick} axisLine={false} tickLine={false} minTickGap={8} />
              <YAxis width={56} tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill={CHART.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Top 5 Best-Selling Medicines" height="h-64" isEmpty={charts.topProducts.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.topProducts} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
              <YAxis dataKey="name" type="category" width={100} tick={{ ...axisTick, fill: CHART.primary }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={money} cursor={{ fill: "#F1F5F9" }} />
              <Bar isAnimationActive={false} dataKey="revenue" name="Revenue" fill={CHART.success} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Category" height="h-64" isEmpty={charts.categoryBreakdown.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={charts.categoryBreakdown} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="revenue" nameKey="name">
                {charts.categoryBreakdown.map((e: any, i: number) => (
                  <Cell key={e.name} fill={CHART.categorical[i % CHART.categorical.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={money} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Registered vs Walk-in Customers" height="h-64" isEmpty={charts.customerType.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={charts.customerType} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="revenue" nameKey="name">
                {charts.customerType.map((e: any, i: number) => (
                  <Cell key={e.name} fill={CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={money} />
              <Legend iconType="circle" wrapperStyle={legendStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
