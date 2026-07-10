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
    <div className="space-y-8 ">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select 
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
              className="pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 "
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
            <select 
              value={paymentMethod}
              onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
              className="pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 "
            >
              <option value="">All Payments</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <input 
              type="text" 
              placeholder="Search Invoice..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 text-sm bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600  placeholder:text-zinc-400"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors "
          >
            Export CSV
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-700 font-semibold text-sm border border-zinc-200 hover:bg-zinc-50 transition-colors "
          >
            Print
          </button>
        </div>

      </div>

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center text-zinc-400 font-mono text-sm uppercase tracking-wider">Loading data...</div>
      ) : data ? (
        <>
          {/* Key Metrics - Ledger Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Total Revenue</p>
              <h3 className="text-3xl font-mono text-zinc-900">${data.metrics.totalRevenue.toFixed(2)}</h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Total Orders</p>
              <h3 className="text-3xl font-mono text-zinc-900">{data.metrics.totalOrders}</h3>
            </div>
            <div className="p-6 border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Items Sold</p>
              <h3 className="text-3xl font-mono text-zinc-900">{data.metrics.totalQtySold}</h3>
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Avg Order Value</p>
              <h3 className="text-3xl font-mono text-zinc-900">${data.metrics.avgOrderValue.toFixed(2)}</h3>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Daily Sales Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#71717a', fontFamily: 'monospace'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                    <RechartsTooltip cursor={{fill: '#f4f4f5'}} contentStyle={{borderRadius: '0px', border: '1px solid #e4e4e7', boxShadow: 'none', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Revenue by Payment</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="method"
                    >
                      {data.charts.paymentMethods.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={['#7c3aed', '#14b8a6', '#f59e0b', '#f43f5e'][index % 4]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} contentStyle={{borderRadius: '0px', border: '1px solid #e4e4e7', fontFamily: 'monospace', fontSize: '12px'}} />
                    <Legend iconType="square" wrapperStyle={{fontSize: '12px', fontFamily: 'monospace'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Sales Register</h3>
              <div className="relative">
                <button 
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors "
                >
                  Columns
                </button>
                {showColumnSettings && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl z-20 p-2 text-sm ">
                    {Object.keys(visibleColumns).map((col) => (
                      <label key={col} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 cursor-pointer capitalize">
                        <input 
                          type="checkbox" 
                          checked={visibleColumns[col as keyof typeof visibleColumns]} 
                          onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                          className="text-indigo-600 focus:ring-indigo-500  border-zinc-300"
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
                    {visibleColumns.invoice_no && <th className="px-6 py-4">Invoice No</th>}
                    {visibleColumns.created_at && <th className="px-6 py-4">Date</th>}
                    {visibleColumns.product_name && <th className="px-6 py-4">Product</th>}
                    {visibleColumns.batch_number && <th className="px-6 py-4">Batch</th>}
                    {visibleColumns.qty && <th className="px-6 py-4 text-right">Qty</th>}
                    {visibleColumns.price && <th className="px-6 py-4 text-right">Price</th>}
                    {visibleColumns.profit && <th className="px-6 py-4 text-right">Profit</th>}
                    {visibleColumns.payment_method && <th className="px-6 py-4 text-center">Payment</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-zinc-500 font-mono">
                        No records found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-zinc-50 transition-colors">
                        {visibleColumns.invoice_no && <td className="px-6 py-4 font-mono text-zinc-900">{row.invoice_no}</td>}
                        {visibleColumns.created_at && <td className="px-6 py-4 text-zinc-500 font-mono">{new Date(row.created_at).toLocaleString()}</td>}
                        {visibleColumns.product_name && <td className="px-6 py-4 font-medium text-zinc-900">{row.product_name}</td>}
                        {visibleColumns.batch_number && <td className="px-6 py-4 text-zinc-500 font-mono">{row.batch_number}</td>}
                        {visibleColumns.qty && <td className="px-6 py-4 text-right font-mono text-zinc-900">{row.qty}</td>}
                        {visibleColumns.price && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.price.toFixed(2)}</td>}
                        {visibleColumns.profit && <td className="px-6 py-4 text-right font-mono text-teal-600">+${row.profit?.toFixed(2) || '0.00'}</td>}
                        {visibleColumns.payment_method && (
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-zinc-100 px-2 py-1 text-zinc-600">
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
            <div className="p-4 border-t border-zinc-200 bg-white flex items-center justify-between">
              <div className="text-xs text-zinc-500 font-mono">
                Showing {((data.table.pagination.page - 1) * data.table.pagination.limit) + 1} to {Math.min(data.table.pagination.page * data.table.pagination.limit, data.table.pagination.total)} of {data.table.pagination.total}
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.table.pagination.page === 1}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors  text-xs font-semibold uppercase tracking-wider"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(data.table.pagination.totalPages, p + 1))}
                  disabled={data.table.pagination.page === data.table.pagination.totalPages || data.table.pagination.totalPages === 0}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors  text-xs font-semibold uppercase tracking-wider"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
