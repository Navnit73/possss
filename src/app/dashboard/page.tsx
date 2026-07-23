"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, Package, AlertTriangle, TrendingUp, DollarSign, 
  Activity, ArrowUpRight, ShoppingCart, Clock, Filter, Loader2 
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export default function DashboardPage() {
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
    endDate: ""
  });

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get("/api/dashboard", { 
        params: { 
          dateRange: activeFilters.dateRange,
          startDate: activeFilters.startDate,
          endDate: activeFilters.endDate
        } 
      });
      setData(res.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      Swal.fire('Error', 'Failed to load dashboard metrics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeFilters]);

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (dateRange === "custom" && (!startDate || !endDate)) {
      Swal.fire('Warning', 'Please select both start date and end date for custom date range.', 'warning');
      return;
    }

    setActiveFilters({
      dateRange,
      startDate,
      endDate
    });
  };

  const PAYMENT_COLORS: { [key: string]: string } = {
    CASH: '#10b981',   // Emerald
    CARD: '#0284c7',   // Sky Blue
    UPI: '#0f172a',    // Dark Slate
    OTHER: '#f59e0b'   // Amber
  };

  const CATEGORY_COLORS = ['#f59e0b', '#0284c7', '#10b981', '#0f172a', '#ef4444', '#f97316'];

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8 font-sans relative min-h-[600px]">
      
      {/* Header & Global Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 sticky top-0 z-20">
        <form onSubmit={handleApplyFilter} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Pharmacy Executive Overview</h1>
            <p className="text-xs text-zinc-500">Real-time store sales, inventory valuation, and cash flow analysis.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Selector */}
            <div className="relative">
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                disabled={isLoading}
                className="pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 rounded disabled:opacity-60"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {dateRange === "custom" && (
              <div className="flex items-center gap-2 bg-amber-50 p-1.5 rounded border border-amber-200">
                <Calendar className="w-4 h-4 text-amber-600 ml-1" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={isLoading}
                  className="px-2 py-1 text-xs border border-zinc-300 rounded bg-white focus:outline-none focus:border-amber-600 font-mono disabled:opacity-60"
                />
                <span className="text-xs text-zinc-500">to</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isLoading}
                  className="px-2 py-1 text-xs border border-zinc-300 rounded bg-white focus:outline-none focus:border-amber-600 font-mono disabled:opacity-60"
                />
              </div>
            )}

            {/* Apply Filter Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:bg-amber-400 transition-colors rounded shadow-xs cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying Filters...
                </>
              ) : (
                <>
                  <Filter className="w-4 h-4" />
                  Apply Filter
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Overlay Backdrop Screen */}
      {isLoading && (
        <div className="absolute inset-0 top-20 bg-white/80 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-8 transition-opacity duration-300">
          <div className="bg-white border border-amber-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-900">Loading Dashboard Metrics</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Aggregating real-time store sales, inventory alerts, and rush hour trends...
              </p>
            </div>
            <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Main Content */}
      {data && (
        <>
          {/* KPI Ledger Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden divide-y md:divide-y-0 md:divide-x divide-zinc-200">
            <Link href="/dashboard/reports/sales" className="p-6 hover:bg-zinc-50 transition-colors block">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Today's Sales</p>
              <h3 className="text-3xl font-mono text-amber-600 font-bold">${data.metrics.todaySales.toFixed(2)}</h3>
            </Link>
            <Link href="/dashboard/reports/profit-loss" className="p-6 hover:bg-zinc-50 transition-colors block">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Monthly Profit</p>
              <h3 className="text-3xl font-mono text-emerald-600 font-bold">${data.metrics.monthlyProfit.toFixed(2)}</h3>
            </Link>
            <Link href="/dashboard/reports/inventory-value" className="p-6 hover:bg-zinc-50 transition-colors block">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Inventory Value</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">${data.metrics.inventoryValue.toFixed(2)}</h3>
            </Link>
            <Link href="/dashboard/inventory/alerts" className="p-6 hover:bg-zinc-50 transition-colors block">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Low Stock Alerts</p>
              <h3 className={`text-3xl font-mono font-bold ${data.metrics.lowStockCount > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                {data.metrics.lowStockCount}
              </h3>
            </Link>
            <Link href="/dashboard/reports/expiry" className="p-6 hover:bg-zinc-50 transition-colors block">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Expiring Soon (30d)</p>
              <h3 className={`text-3xl font-mono font-bold ${data.metrics.expiringSoonCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                {data.metrics.expiringSoonCount}
              </h3>
            </Link>
          </div>

          {/* Row 1 Charts: Sales Revenue & Profit Trend + Payment Method Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Revenue vs Profit Trend (Dual Line Chart - Solid Colors) */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">1. Sales Revenue vs Net Profit ($)</h3>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Net Profit</span>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Revenue by Payment Method (Donut Chart) */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">2. Revenue by Payment Method</h3>
              <div className="h-72 flex items-center justify-center">
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
                        <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] || '#f59e0b'} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => `$${Number(val).toFixed(2)}`} contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontFamily: 'monospace'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 2 Charts: Peak Hourly Rush + Category Sales + Top Selling Medicines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Chart 3: Peak Hourly Rush Hours Bar Chart */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">3. Peak Pharmacy Rush Hours</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.hourlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="hour" tick={{fontSize: 9, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="revenue" name="Hourly Revenue" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Sales by Medicine Category Donut */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">4. Sales by Medicine Category</h3>
              <div className="h-64 flex items-center justify-center">
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
                    <RechartsTooltip formatter={(val: any) => `$${Number(val).toFixed(2)}`} contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontFamily: 'monospace'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Leaderboard: Top Selling Products */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">5. Top Selling Medicines</h3>
                  <Link href="/dashboard/reports/fast-moving" className="text-xs font-bold text-amber-600 hover:text-amber-700">
                    View Ranking ➔
                  </Link>
                </div>
                {data.topProducts.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-mono py-8 text-center">No sales recorded for this period.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 text-xs">
                    {data.topProducts.map((product: any, idx: number) => (
                      <li key={product._id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-zinc-400 font-bold w-4">#{idx + 1}</span>
                          <span className="font-medium text-zinc-900 truncate">{product.name}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-amber-600 font-bold">${product.revenue.toFixed(2)}</span>
                          <span className="text-zinc-400 text-[10px] block">{product.qty_sold} sold</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
