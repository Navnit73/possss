"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import Papa from "papaparse";

export default function FastMovingReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [dateRange, setDateRange] = useState("today");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    product_name: true,
    category: true,
    qty_sold: true,
    revenue_generated: true,
    profit_generated: true,
    avg_daily_sales: true,
    current_stock: true,
    estimated_stock_days: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        dateRange,
        search,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/fast-moving", { params });
      
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
  }, [dateRange, page, limit]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Product": item.product_name,
      "Category": item.category,
      "Qty Sold": item.qty_sold,
      "Revenue Generated": item.revenue_generated,
      "Profit Generated": item.profit_generated,
      "Avg Daily Sales": item.avg_daily_sales,
      "Current Stock": item.current_stock,
      "Estimated Stock Days": item.estimated_stock_days === 9999 ? "∞" : item.estimated_stock_days
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Fast_Moving_Products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <div className="space-y-8">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select 
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
              className="pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 rounded"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
            </select>
          </div>

          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <input 
              type="text" 
              placeholder="Search Product..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 text-sm bg-white focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 placeholder:text-zinc-400 rounded"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 transition-colors rounded"
          >
            Export CSV
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-700 font-semibold text-sm border border-zinc-200 hover:bg-zinc-50 transition-colors rounded"
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
          <div className="grid grid-cols-2 md:grid-cols-3 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200 bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-2">Top Selling Product</p>
              <h3 className="text-2xl font-mono text-amber-900 line-clamp-1 font-bold">
                {data.metrics.topPerformers[0] || "N/A"}
              </h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Products Analyzed</p>
              <h3 className="text-3xl font-mono text-zinc-900 font-bold">{data.metrics.totalAnalyzed}</h3>
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Ranked By</p>
              <h3 className="text-2xl font-mono text-zinc-900 font-bold">Total Units Sold</h3>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Fast Moving Products Ranking</h3>
              <div className="relative">
                <button 
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
                        {col.replace(/_/g, ' ')}
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
                    <th className="px-6 py-4 text-center w-12">#</th>
                    {visibleColumns.product_name && <th className="px-6 py-4">Product</th>}
                    {visibleColumns.category && <th className="px-6 py-4">Category</th>}
                    {visibleColumns.qty_sold && <th className="px-6 py-4 text-right">Units Sold</th>}
                    {visibleColumns.revenue_generated && <th className="px-6 py-4 text-right">Revenue</th>}
                    {visibleColumns.profit_generated && <th className="px-6 py-4 text-right">Profit</th>}
                    {visibleColumns.avg_daily_sales && <th className="px-6 py-4 text-right">Avg Daily</th>}
                    {visibleColumns.current_stock && <th className="px-6 py-4 text-right">Stock</th>}
                    {visibleColumns.estimated_stock_days && <th className="px-6 py-4 text-right">Est. Days Left</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-zinc-500 font-mono">
                        No sales found for this period.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any, index: number) => {
                      const rank = ((data.table.pagination.page - 1) * data.table.pagination.limit) + index + 1;
                      return (
                      <tr key={row._id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-6 py-4 text-center font-mono font-medium text-zinc-400">{rank}</td>
                        {visibleColumns.product_name && <td className="px-6 py-4 font-medium text-zinc-900">{row.product_name}</td>}
                        {visibleColumns.category && <td className="px-6 py-4 text-zinc-500 font-mono">{row.category}</td>}
                        {visibleColumns.qty_sold && <td className="px-6 py-4 text-right font-mono font-bold text-amber-600">{row.qty_sold}</td>}
                        {visibleColumns.revenue_generated && <td className="px-6 py-4 text-right font-mono text-zinc-900">${row.revenue_generated.toFixed(2)}</td>}
                        {visibleColumns.profit_generated && <td className="px-6 py-4 text-right text-emerald-600 font-mono font-bold">+${row.profit_generated.toFixed(2)}</td>}
                        {visibleColumns.avg_daily_sales && <td className="px-6 py-4 text-right font-mono text-zinc-900">{row.avg_daily_sales.toFixed(1)}/day</td>}
                        {visibleColumns.current_stock && <td className="px-6 py-4 text-right font-mono text-zinc-900">{row.current_stock}</td>}
                        {visibleColumns.estimated_stock_days && (
                          <td className="px-6 py-4 text-right">
                            {row.estimated_stock_days === 9999 ? (
                              <span className="text-zinc-400 font-mono">∞</span>
                            ) : (
                              <span className={`font-mono font-bold ${row.estimated_stock_days < 7 ? 'text-rose-600' : 'text-zinc-900'}`}>
                                {row.estimated_stock_days.toFixed(0)} d
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    )})
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
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(data.table.pagination.totalPages, p + 1))}
                  disabled={data.table.pagination.page === data.table.pagination.totalPages || data.table.pagination.totalPages === 0}
                  className="px-3 py-1 border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider rounded"
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
