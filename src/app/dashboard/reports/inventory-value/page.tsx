"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Download, Search, Printer, ChevronLeft, ChevronRight, 
  Settings2, Package, Layers, Banknote, TrendingUp
} from "lucide-react";
import Papa from "papaparse";

export default function InventoryValueReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    product_name: true,
    batch_number: true,
    rack_location: true,
    qty_available: true,
    cost_price: true,
    selling_price: true,
    total_cost_value: true,
    expiry_date: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        search,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/inventory-value", { params });
      
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
  }, [page, limit]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Product": item.product_name,
      "Category": item.category,
      "Batch": item.batch_number,
      "Rack": item.rack_location,
      "Qty Available": item.qty_available,
      "Cost Price": item.cost_price,
      "Selling Price": item.selling_price,
      "Total Cost Value": item.total_cost_value,
      "Expected Revenue": item.expected_revenue,
      "Expiry Date": item.expiry_date
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Inventory_Value_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleColumn = (col: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row justify-between gap-4">
        
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Product or Batch..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </form>

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

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading report...</div>
      ) : data ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Unique Products</p>
                <h3 className="text-2xl font-black text-slate-900">{data.metrics.total_products}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Stock Qty</p>
                <h3 className="text-2xl font-black text-slate-900">{data.metrics.total_stock_qty}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Inventory Value (Cost)</p>
                <h3 className="text-2xl font-black text-slate-900">${data.metrics.purchase_value.toFixed(2)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Expected Profit</p>
                <h3 className="text-2xl font-black text-emerald-600">${data.metrics.expected_profit.toFixed(2)}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-slate-800">Current Stock Valuation</h3>
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
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {visibleColumns.product_name && <th className="px-4 py-3">Product</th>}
                    {visibleColumns.batch_number && <th className="px-4 py-3">Batch</th>}
                    {visibleColumns.rack_location && <th className="px-4 py-3">Rack</th>}
                    {visibleColumns.qty_available && <th className="px-4 py-3 text-right">Available Qty</th>}
                    {visibleColumns.cost_price && <th className="px-4 py-3 text-right">Cost Price</th>}
                    {visibleColumns.selling_price && <th className="px-4 py-3 text-right">Selling Price</th>}
                    {visibleColumns.total_cost_value && <th className="px-4 py-3 text-right">Total Cost Val</th>}
                    {visibleColumns.expiry_date && <th className="px-4 py-3">Expiry Date</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        No active stock found.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.product_name && <td className="px-4 py-2 font-medium text-slate-900">{row.product_name}</td>}
                        {visibleColumns.batch_number && <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.batch_number}</td>}
                        {visibleColumns.rack_location && <td className="px-4 py-2 text-slate-600">{row.rack_location}</td>}
                        {visibleColumns.qty_available && <td className="px-4 py-2 text-right font-bold text-slate-900">{row.qty_available}</td>}
                        {visibleColumns.cost_price && <td className="px-4 py-2 text-right">${row.cost_price.toFixed(2)}</td>}
                        {visibleColumns.selling_price && <td className="px-4 py-2 text-right">${row.selling_price.toFixed(2)}</td>}
                        {visibleColumns.total_cost_value && <td className="px-4 py-2 text-right font-semibold">${row.total_cost_value.toFixed(2)}</td>}
                        {visibleColumns.expiry_date && (
                          <td className="px-4 py-2">
                            {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : 'N/A'}
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
