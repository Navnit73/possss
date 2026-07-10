"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Download, Calendar, Search, Filter, Printer, ChevronLeft, ChevronRight, 
  Settings2, Activity, Banknote, ShoppingCart, TrendingUp
} from "lucide-react";
import Papa from "papaparse";

export default function SalesReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [dateRange, setDateRange] = useState("30days");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    invoice_no: true,
    created_at: true,
    product_name: true,
    batch_number: true,
    qty: true,
    price: true,
    payment_method: true,
    profit: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        dateRange,
        search,
        paymentMethod,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/sales", { params });
      
      if (exportMode) {
        exportToCSV(res.data.table.data);
      } else {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch report", err);
      alert("Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange, paymentMethod, page, limit]); // Re-fetch on filter change (except search, we'll do search on submit)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Invoice No": item.invoice_no,
      "Date": new Date(item.created_at).toLocaleString(),
      "Product": item.product_name,
      "Batch": item.batch_number,
      "Qty": item.qty,
      "Price": item.price,
      "Item Discount %": item.item_discount,
      "Profit": item.profit,
      "Payment": item.payment_method
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={dateRange}
                onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
                className="pl-9 pr-8 py-2 border border-slate-200 rounded-md text-sm font-medium bg-slate-50 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
                className="pl-9 pr-8 py-2 border border-slate-200 rounded-md text-sm font-medium bg-slate-50 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">All Payments</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            
            <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search Invoice..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold text-sm rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold text-sm rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>

        </div>
      </div>

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading report...</div>
      ) : data ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Revenue</p>
                <h3 className="text-2xl font-black text-slate-900">${data.metrics.totalRevenue.toFixed(2)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Orders</p>
                <h3 className="text-2xl font-black text-slate-900">{data.metrics.totalOrders}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Items Sold</p>
                <h3 className="text-2xl font-black text-slate-900">{data.metrics.totalQtySold}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Avg Order Value</p>
                <h3 className="text-2xl font-black text-slate-900">${data.metrics.avgOrderValue.toFixed(2)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Daily Sales Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue by Payment</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="revenue"
                      nameKey="method"
                    >
                      {data.charts.paymentMethods.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-slate-800">Sales Register</h3>
              <div className="relative">
                <button 
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Columns
                </button>
                {showColumnSettings && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 text-sm">
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer capitalize">
                        <input 
                          type="checkbox" 
                          checked={visibleColumns[col as keyof typeof visibleColumns]} 
                          onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
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
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {visibleColumns.invoice_no && <th className="px-4 py-3">Invoice No</th>}
                    {visibleColumns.created_at && <th className="px-4 py-3">Date</th>}
                    {visibleColumns.product_name && <th className="px-4 py-3">Product</th>}
                    {visibleColumns.batch_number && <th className="px-4 py-3">Batch</th>}
                    {visibleColumns.qty && <th className="px-4 py-3 text-right">Qty</th>}
                    {visibleColumns.price && <th className="px-4 py-3 text-right">Price</th>}
                    {visibleColumns.profit && <th className="px-4 py-3 text-right">Profit</th>}
                    {visibleColumns.payment_method && <th className="px-4 py-3 text-center">Payment</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.invoice_no && <td className="px-4 py-2 font-mono text-xs font-medium text-slate-900">{row.invoice_no}</td>}
                        {visibleColumns.created_at && <td className="px-4 py-2 text-slate-600">{new Date(row.created_at).toLocaleString()}</td>}
                        {visibleColumns.product_name && <td className="px-4 py-2 font-medium text-slate-900">{row.product_name}</td>}
                        {visibleColumns.batch_number && <td className="px-4 py-2 text-slate-600 font-mono text-xs">{row.batch_number}</td>}
                        {visibleColumns.qty && <td className="px-4 py-2 text-right font-semibold">{row.qty}</td>}
                        {visibleColumns.price && <td className="px-4 py-2 text-right">${row.price.toFixed(2)}</td>}
                        {visibleColumns.profit && <td className="px-4 py-2 text-right text-emerald-600 font-medium">+${row.profit?.toFixed(2) || '0.00'}</td>}
                        {visibleColumns.payment_method && (
                          <td className="px-4 py-2 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                              {row.payment_method}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-lg">
              <div className="text-xs text-slate-500 font-medium">
                Showing {((data.table.pagination.page - 1) * data.table.pagination.limit) + 1} to {Math.min(data.table.pagination.page * data.table.pagination.limit, data.table.pagination.total)} of {data.table.pagination.total} entries
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.table.pagination.page === 1}
                  className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(data.table.pagination.totalPages, p + 1))}
                  disabled={data.table.pagination.page === data.table.pagination.totalPages || data.table.pagination.totalPages === 0}
                  className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
