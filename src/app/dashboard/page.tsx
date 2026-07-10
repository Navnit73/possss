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
      color: "bg-emerald-50 text-emerald-600",
      link: "/dashboard/reports/sales"
    },
    {
      title: "Monthly Profit",
      value: `$${metrics.monthlyProfit.toFixed(2)}`,
      icon: TrendingUp,
      color: "bg-indigo-50 text-indigo-600",
      link: "/dashboard/reports/profit-loss"
    },
    {
      title: "Inventory Value",
      value: `$${metrics.inventoryValue.toFixed(2)}`,
      icon: Package,
      color: "bg-blue-50 text-blue-600",
      link: "/dashboard/reports/inventory-value"
    },
    {
      title: "Low Stock Items",
      value: metrics.lowStockCount,
      icon: Activity,
      color: "bg-rose-50 text-rose-600",
      link: "/dashboard/inventory/alerts"
    },
    {
      title: "Expiring Soon (30d)",
      value: metrics.expiringSoonCount,
      icon: Clock,
      color: "bg-amber-50 text-amber-600",
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-1">Overview</h1>
          <p className="text-slate-500 text-sm">Welcome back! Here's what's happening with your store today.</p>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpiCards.map((card, idx) => (
          <Link key={idx} href={card.link} className="group">
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col h-full">
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>
              <div className="mt-auto relative z-10">
                <p className="text-sm font-semibold text-slate-500 mb-1">{card.title}</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</h3>
              </div>
              {/* Decorative background circle */}
              <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500 ease-out ${card.color.split(' ')[0]}`} />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" /> Revenue vs Profit Trend
            </h2>
          </div>
          <div className="p-5 flex-1 min-h-[350px]">
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
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tickFormatter={(val) => `$${val}`} 
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip 
                  labelFormatter={formatTooltipDate}
                  formatter={(value: any, name: any) => {
                    const safeName = String(name || "");
                    return [`$${Number(value).toFixed(2)}`, safeName.charAt(0).toUpperCase() + safeName.slice(1)]
                  }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-500" /> Top Selling Products
            </h2>
            <Link href="/dashboard/reports/fast-moving" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View All
            </Link>
          </div>
          <div className="p-0 flex-1 flex flex-col">
            {topProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <ShoppingCart className="w-12 h-12 mb-3 text-slate-200" />
                <p className="text-sm font-medium">No sales data for this period.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {topProducts.map((product: any, idx: number) => (
                  <li key={product._id} className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-4">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.qty_sold} units sold</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-600">${product.revenue.toFixed(2)}</p>
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
