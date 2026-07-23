"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Filter, Calendar, Loader2 } from "lucide-react";
import Papa from "papaparse";

export default function ProfitLossReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Draft Filters state
  const [dateRange, setDateRange] = useState("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Active Filters state
  const [activeFilters, setActiveFilters] = useState({
    dateRange: "30days",
    startDate: "",
    endDate: "",
    search: ""
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    product_name: true,
    category: true,
    qty_sold: true,
    total_cost: true,
    total_revenue: true,
    profit: true,
    margin_pct: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        dateRange: activeFilters.dateRange,
        startDate: activeFilters.startDate,
        endDate: activeFilters.endDate,
        search: activeFilters.search,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/profit-loss", { params });
      
      if (exportMode) {
        exportToCSV(res.data.table.data);
      } else {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch report", err);
      Swal.fire('Error', String("Failed to load report data"), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeFilters, page, limit]); 

  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (dateRange === "custom" && (!startDate || !endDate)) {
      Swal.fire('Warning', 'Please select both start date and end date for custom date range.', 'warning');
      return;
    }

    setPage(1);
    setActiveFilters({
      dateRange,
      startDate,
      endDate,
      search
    });
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Product": item.product_name,
      "Category": item.category,
      "Qty Sold": item.qty_sold,
      "Total Cost": item.total_cost,
      "Total Revenue": item.total_revenue,
      "Profit": item.profit,
      "Margin %": item.margin_pct
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Profit_Loss_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const CATEGORY_COLORS = ['#10b981', '#f59e0b', '#0284c7', '#8b5cf6', '#ec4899', '#f97316'];

  return (
    <div className="space-y-8 relative min-h-[600px]">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 sticky top-0 z-20">
        <form onSubmit={handleApplyFilter} className="flex flex-col gap-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* Filter Inputs Group */}
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
              
              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <input 
                  type="text" 
                  placeholder="Search Product..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-zinc-200 text-sm bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder:text-zinc-400 rounded disabled:opacity-60"
                />
              </div>

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

            {/* Export CSV Action (Print Removed) */}
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => fetchReport(true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white font-semibold text-sm hover:bg-zinc-900 disabled:opacity-60 transition-colors rounded shadow-xs"
              >
                Export CSV
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* Loading Overlay Screen */}
      {isLoading && (
        <div className="absolute inset-0 top-20 bg-white/80 backdrop-blur-xs z-30 flex flex-col items-center justify-center p-8 transition-opacity duration-300">
          <div className="bg-white border border-amber-200 rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4 flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h4 className="text-base font-bold text-zinc-900">Applying Filters & Calculating P&L</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Auditing gross revenue, stock cost of goods sold, profit margins, and discount leakage...
              </p>
            </div>
            <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Report Content */}
      {data && (
        <>
          {/* Key Metrics - Ledger Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Gross Revenue</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">${data.metrics.gross_revenue.toFixed(2)}</h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Product Cost (COGS)</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">${data.metrics.product_cost.toFixed(2)}</h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Gross Profit</p>
              <h3 className={`text-3xl font-mono font-bold ${data.metrics.gross_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ${data.metrics.gross_profit.toFixed(2)}
              </h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Profit Margin</p>
              <h3 className="text-3xl font-mono text-amber-600 font-bold">{data.metrics.margin_pct.toFixed(1)}%</h3>
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Total Discounts</p>
              <h3 className="text-3xl font-mono text-rose-600 font-bold">${data.metrics.discounts_given.toFixed(2)}</h3>
            </div>
          </div>

          {/* Row 1 Charts: Daily Revenue vs Net Profit & Profit Contribution by Category */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Daily Gross Profit & COGS Trend Area Chart */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">1. Daily Revenue, COGS & Net Profit Trend ($)</h3>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" /> COGS</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Net Profit</span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.dailyProfitTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevPL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfPL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="date" tick={{fontSize: 11, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 11, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#f59e0b" fillOpacity={1} fill="url(#colorRevPL)" strokeWidth={2} />
                    <Line type="monotone" dataKey="cogs" name="COGS Cost" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                    <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfPL)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Profit Contribution by Medicine Category */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">2. Profit Share by Medicine Category</h3>
              <div className="h-72 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.categoryProfit}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="profit"
                      nameKey="name"
                    >
                      {data.charts.categoryProfit.map((entry: any, index: number) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => `$${Number(val).toFixed(2)}`} contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '11px', fontFamily: 'monospace'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Row 2 Charts: Top 5 Profitable Products, Financial Waterfall & Discount Leakage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Chart 3: Top 5 Most Profitable Medicines */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">3. Top 5 Most Profitable Medicines</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.topProfitableProducts} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                    <XAxis type="number" tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 10, fill: '#3f3f46', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="profit" name="Net Profit" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Financial Waterfall Breakdown */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">4. Financial P&L Waterfall Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.waterfall} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="category" tick={{fontSize: 9, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                      {data.charts.waterfall.map((entry: any, index: number) => (
                        <Cell key={`waterfall-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 5: Discount Leakage & Margin Loss */}
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">5. Discount Leakage & Margin Loss ($)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.discountBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{borderRadius: '4px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} formatter={(val: any) => `$${Number(val).toFixed(2)}`} />
                    <Bar dataKey="amount" name="Discount Total" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Data Table */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Product Profitability</h3>
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors rounded"
                >
                  Columns
                </button>
                {showColumnSettings && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl z-20 p-2 text-sm">
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 cursor-pointer capitalize">
                        <input 
                          type="checkbox" 
                          checked={visibleColumns[col as keyof typeof visibleColumns]} 
                          onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                          className="text-amber-600 focus:ring-amber-500 border-zinc-300"
                        />
                        {col.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b border-zinc-200 text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                    {visibleColumns.product_name && <th className="px-6 py-4">Product</th>}
                    {visibleColumns.category && <th className="px-6 py-4">Category</th>}
                    {visibleColumns.qty_sold && <th className="px-6 py-4 text-right">Qty Sold</th>}
                    {visibleColumns.total_cost && <th className="px-6 py-4 text-right">Cost</th>}
                    {visibleColumns.total_revenue && <th className="px-6 py-4 text-right">Revenue</th>}
                    {visibleColumns.profit && <th className="px-6 py-4 text-right">Profit</th>}
                    {visibleColumns.margin_pct && <th className="px-6 py-4 text-right">Margin %</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-mono">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-zinc-50 transition-colors">
                        {visibleColumns.product_name && <td className="px-6 py-4 font-medium text-zinc-900">{row.product_name}</td>}
                        {visibleColumns.category && <td className="px-6 py-4 text-zinc-500 font-mono">{row.category}</td>}
                        {visibleColumns.qty_sold && <td className="px-6 py-4 text-right font-mono text-zinc-900">{row.qty_sold}</td>}
                        {visibleColumns.total_cost && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.total_cost.toFixed(2)}</td>}
                        {visibleColumns.total_revenue && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.total_revenue.toFixed(2)}</td>}
                        {visibleColumns.profit && (
                          <td className={`px-6 py-4 text-right font-mono font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.profit >= 0 ? '+' : ''}${row.profit.toFixed(2)}
                          </td>
                        )}
                        {visibleColumns.margin_pct && (
                          <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">{row.margin_pct.toFixed(1)}%</td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between">
              <div className="text-xs text-zinc-500 font-mono">
                Showing {((data.table.pagination.page - 1) * data.table.pagination.limit) + 1} to {Math.min(data.table.pagination.page * data.table.pagination.limit, data.table.pagination.total)} of {data.table.pagination.total}
              </div>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.table.pagination.page === 1 || isLoading}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Prev
                </button>
                <button 
                  type="button"
                  onClick={() => setPage(p => Math.min(data.table.pagination.totalPages, p + 1))}
                  disabled={data.table.pagination.page === data.table.pagination.totalPages || data.table.pagination.totalPages === 0 || isLoading}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
