"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Download, Search, Printer, ChevronLeft, ChevronRight, 
  Settings2, AlertTriangle, AlertCircle, AlertOctagon, Info
} from "lucide-react";
import Papa from "papaparse";

export default function ExpiryReportPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Columns visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    product_name: true,
    batch_number: true,
    supplier_name: true,
    qty_available: true,
    cost_price: true,
    purchase_value_loss: true,
    expiry_date: true,
    status: true
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const fetchReport = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        search,
        status,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/reports/expiry", { params });
      
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
  }, [status, page, limit]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Product": item.product_name,
      "Batch": item.batch_number,
      "Supplier": item.supplier_name,
      "Qty": item.qty_available,
      "Cost Price": item.cost_price,
      "Value Loss": item.purchase_value_loss,
      "Expiry Date": item.expiry_date,
      "Status": item.status
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Expiry_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select 
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="pl-3 pr-8 py-2 border border-slate-200 rounded-md text-sm font-medium bg-slate-50 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            >
              <option value="all">All At Risk (≤ 90 Days)</option>
              <option value="expired">Already Expired</option>
              <option value="30days">Expires in 30 Days</option>
              <option value="60days">Expires in 60 Days</option>
              <option value="90days">Expires in 90 Days</option>
            </select>
          </div>

          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Product..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 font-semibold text-sm rounded-md border border-red-200 hover:bg-red-100 transition-colors"
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
            <div className="bg-red-50 p-5 rounded-lg border border-red-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Expired (Loss)</p>
                <h3 className="text-2xl font-black text-red-900">
                  {data.metrics.expired_count} <span className="text-sm font-medium text-red-700">(${data.metrics.expired_value.toFixed(2)})</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-orange-50 p-5 rounded-lg border border-orange-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">Next 30 Days</p>
                <h3 className="text-2xl font-black text-orange-900">{data.metrics.days30_count} <span className="text-sm font-medium text-orange-700">Batches</span></h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-amber-50 p-5 rounded-lg border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Next 60 Days</p>
                <h3 className="text-2xl font-black text-amber-900">{data.metrics.days60_count} <span className="text-sm font-medium text-amber-700">Batches</span></h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-yellow-800 uppercase tracking-wider mb-1">Next 90 Days</p>
                <h3 className="text-2xl font-black text-yellow-900">{data.metrics.days90_count} <span className="text-sm font-medium text-yellow-700">Batches</span></h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                <Info className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
              <h3 className="font-bold text-slate-800">At-Risk Batches</h3>
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
                    {visibleColumns.supplier_name && <th className="px-4 py-3">Supplier</th>}
                    {visibleColumns.qty_available && <th className="px-4 py-3 text-right">Qty</th>}
                    {visibleColumns.cost_price && <th className="px-4 py-3 text-right">Cost</th>}
                    {visibleColumns.purchase_value_loss && <th className="px-4 py-3 text-right">Value Loss</th>}
                    {visibleColumns.expiry_date && <th className="px-4 py-3">Expiry Date</th>}
                    {visibleColumns.status && <th className="px-4 py-3 text-center">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        No expiring batches found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.product_name && <td className="px-4 py-2 font-medium text-slate-900">{row.product_name}</td>}
                        {visibleColumns.batch_number && <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.batch_number}</td>}
                        {visibleColumns.supplier_name && <td className="px-4 py-2 text-slate-600 truncate max-w-[150px]">{row.supplier_name}</td>}
                        {visibleColumns.qty_available && <td className="px-4 py-2 text-right font-bold">{row.qty_available}</td>}
                        {visibleColumns.cost_price && <td className="px-4 py-2 text-right">${row.cost_price.toFixed(2)}</td>}
                        {visibleColumns.purchase_value_loss && <td className="px-4 py-2 text-right font-semibold text-red-600">${row.purchase_value_loss.toFixed(2)}</td>}
                        {visibleColumns.expiry_date && <td className="px-4 py-2">{new Date(row.expiry_date).toLocaleDateString()}</td>}
                        {visibleColumns.status && (
                          <td className="px-4 py-2 text-center">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border
                              ${row.status === 'Expired' ? 'bg-red-100 text-red-700 border-red-200' : 
                                row.status === '30 Days' ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                                row.status === '60 Days' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                'bg-yellow-100 text-yellow-700 border-yellow-200'}`}
                            >
                              {row.status}
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
