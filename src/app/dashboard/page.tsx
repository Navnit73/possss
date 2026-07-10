"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Calendar, Package, AlertTriangle, TrendingUp, DollarSign, 
  Activity, ArrowUpRight, BarChart3, ShoppingCart, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell
} from "recharts";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30days");

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get("/api/dashboard", { params: { dateRange } });
        setData(res.data);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, [dateRange]);

  if (isLoading && !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto h-[80vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Loading dashboard metrics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-medium">Failed to load dashboard data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const { metrics, chartData, topProducts } = data;

  const kpiCards = [
    {
      title: "Today's Sales",
      value: `$${metrics.todaySales.toFixed(2)}`,
      icon: DollarSign,
      iconWrapper: "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 border border-emerald-100/50",
      circleColor: "bg-emerald-500",
      link: "/dashboard/reports/sales"
    },
    {
      title: "Monthly Profit",
      value: `$${metrics.monthlyProfit.toFixed(2)}`,
      icon: TrendingUp,
      iconWrapper: "bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 border border-indigo-100/50",
      circleColor: "bg-indigo-500",
      link: "/dashboard/reports/profit-loss"
    },
    {
      title: "Inventory Value",
      value: `$${metrics.inventoryValue.toFixed(2)}`,
      icon: Package,
      iconWrapper: "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 border border-blue-100/50",
      circleColor: "bg-blue-500",
      link: "/dashboard/reports/inventory-value"
    },
    {
      title: "Low Stock Items",
      value: metrics.lowStockCount,
      icon: Activity,
      iconWrapper: "bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600 border border-rose-100/50",
      circleColor: "bg-rose-500",
      link: "/dashboard/inventory/alerts"
    },
    {
      title: "Expiring Soon (30d)",
      value: metrics.expiringSoonCount,
      icon: Clock,
      iconWrapper: "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 border border-amber-100/50",
      circleColor: "bg-amber-500",
      link: "/dashboard/reports/expiry"
    }
  ];

  const formatTooltipDate = (dateStr: any) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatXAxisDate = (dateStr: any) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-10 font-sans">
      
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <PageHeader 
          title="Overview"
          description="Welcome back! Here's what's happening with your store today."
        />
        <div className="relative group">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 transition-all min-w-[160px]"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {kpiCards.map((card, idx) => (
          <Link key={idx} href={card.link} className="group block">
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 relative overflow-hidden flex flex-col h-full hover:-translate-y-1">
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${card.iconWrapper}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div className="bg-slate-50/80 p-2 rounded-full group-hover:bg-slate-100 transition-colors border border-slate-100">
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                </div>
              </div>
              <div className="mt-auto relative z-10">
                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{card.value}</h3>
              </div>
              {/* Decorative background element */}
              <div className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full opacity-[0.04] transition-transform group-hover:scale-125 duration-700 ease-out ${card.circleColor}`} />
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100/80 flex items-center justify-between bg-slate-50/30">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <BarChart3 className="w-4 h-4" />
              </div>
              Revenue vs Profit Trend
            </h2>
          </div>
          <div className="p-6 flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatXAxisDate} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={12}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(val) => `$${val}`} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={12}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip 
                  labelFormatter={formatTooltipDate}
                  formatter={(value: any, name: any) => {
                    const safeName = String(name || "");
                    return [`$${Number(value).toFixed(2)}`, safeName.charAt(0).toUpperCase() + safeName.slice(1)]
                  }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100/80 flex items-center justify-between bg-slate-50/30">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
              Top Selling Products
            </h2>
            <Link href="/dashboard/reports/fast-moving" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors">
              View All
            </Link>
          </div>
          <div className="p-0 flex-1 flex flex-col">
            {topProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center min-h-[300px]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">No sales data for this period.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100/80">
                {topProducts.map((product: any, idx: number) => (
                  <li key={product._id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold text-slate-900 truncate mb-0.5">{product.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        {product.qty_sold} units sold
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-black text-slate-900">${product.revenue.toFixed(2)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
