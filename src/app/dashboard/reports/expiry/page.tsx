"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import Papa from "papaparse";
import { useCurrency } from "@/context/CurrencyContext";

export default function ExpiryReportPage() {
  const { formatCurrency } = useCurrency();
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
      Swal.fire('Error', String("Failed to load report data"), 'error');
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
    <div className="space-y-8">
      
      {/* Top Filter Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-4 flex flex-col md:flex-row justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select 
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="pl-3 pr-8 py-2 border border-zinc-200 text-sm font-medium bg-zinc-50 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 rounded"
            >
              <option value="all">All At Risk (≤ 90 Days)</option>
              <option value="expired">Already Expired</option>
              <option value="30days">Expires in 30 Days</option>
              <option value="60days">Expires in 60 Days</option>
              <option value="90days">Expires in 90 Days</option>
            </select>
          </div>

          <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
            <input 
              type="text" 
              placeholder="Search Product..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 text-sm bg-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 placeholder:text-zinc-400 rounded"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors rounded"
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
          <div className="grid grid-cols-2 md:grid-cols-4 border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Expired (Loss)</p>
              <h3 className="text-3xl font-mono text-rose-600 font-bold">
                {data.metrics.expired_count} <span className="text-sm font-medium text-rose-400">({formatCurrency(data.metrics.expired_value)})</span>
              </h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Next 30 Days</p>
              <h3 className="text-3xl font-mono text-orange-600 font-bold">{data.metrics.days30_count} <span className="text-sm font-medium text-orange-400">Batches</span></h3>
            </div>
            <div className="p-6 border-b md:border-b-0 md:border-r border-zinc-200">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Next 60 Days</p>
              <h3 className="text-3xl font-mono text-amber-600 font-bold">{data.metrics.days60_count} <span className="text-sm font-medium text-amber-400">Batches</span></h3>
            </div>
            <div className="p-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Next 90 Days</p>
              <h3 className="text-3xl font-mono text-yellow-600 font-bold">{data.metrics.days90_count} <span className="text-sm font-medium text-yellow-500">Batches</span></h3>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">At-Risk Batches</h3>
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
                          className="text-red-600 focus:ring-red-500 border-zinc-300"
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
                    {visibleColumns.product_name && <th className="px-6 py-4">Product</th>}
                    {visibleColumns.batch_number && <th className="px-6 py-4">Batch</th>}
                    {visibleColumns.supplier_name && <th className="px-6 py-4">Supplier</th>}
                    {visibleColumns.qty_available && <th className="px-6 py-4 text-right">Qty</th>}
                    {visibleColumns.cost_price && <th className="px-6 py-4 text-right">Cost</th>}
                    {visibleColumns.purchase_value_loss && <th className="px-6 py-4 text-right">Value Loss</th>}
                    {visibleColumns.expiry_date && <th className="px-6 py-4">Expiry Date</th>}
                    {visibleColumns.status && <th className="px-6 py-4 text-center">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {data.table.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-mono">
                        No expiring batches found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    data.table.data.map((row: any) => (
                      <tr key={row._id} className="hover:bg-zinc-50 transition-colors">
                        {visibleColumns.product_name && <td className="px-6 py-4 font-medium text-zinc-900">{row.product_name}</td>}
                        {visibleColumns.batch_number && <td className="px-6 py-4 font-mono text-xs text-zinc-500">{row.batch_number}</td>}
                        {visibleColumns.supplier_name && <td className="px-6 py-4 text-zinc-600 truncate max-w-[150px] font-mono">{row.supplier_name}</td>}
                        {visibleColumns.qty_available && <td className="px-6 py-4 text-right font-mono font-bold text-zinc-900">{row.qty_available}</td>}
                        {visibleColumns.cost_price && <td className="px-6 py-4 text-right font-mono text-zinc-900">{formatCurrency(row.cost_price)}</td>}
                        {visibleColumns.purchase_value_loss && <td className="px-6 py-4 text-right font-mono font-bold text-rose-600">{formatCurrency(row.purchase_value_loss)}</td>}
                        {visibleColumns.expiry_date && <td className="px-6 py-4 font-mono text-zinc-600">{new Date(row.expiry_date).toLocaleDateString()}</td>}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 text-center">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 border rounded
                              ${row.status === 'Expired' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                                row.status === '30 Days' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                row.status === '60 Days' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                'bg-yellow-50 text-yellow-700 border-yellow-200'}`}
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
