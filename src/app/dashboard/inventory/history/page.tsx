"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { History, ArrowRight, Search, Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import Papa from "papaparse";

export default function StockHistoryPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const today = new Date().toISOString().split('T')[0];
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const fetchMovements = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      const params = {
        search,
        type,
        startDate,
        endDate,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/inventory/movements", { params });
      
      if (exportMode) {
        exportToCSV(res.data.data);
      } else {
        setMovements(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      if (!exportMode) {
        setError(err.response?.data?.error || "Failed to load stock history");
      } else {
        alert("Failed to export data");
      }
    } finally {
      if (!exportMode) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMovements();
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Date": new Date(item.created_at).toLocaleString(),
      "Product": item.product?.name || "Unknown Product",
      "Batch": item.batch?.batch_number || item.batch_id,
      "Type": item.movement_type,
      "Quantity Change": item.quantity,
      "Before Qty": item.before_qty,
      "After Qty": item.after_qty,
      "User": item.user?.name || "System",
      "Notes": item.notes || ""
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Stock_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getMovementColor = (type: string, qty: number) => {
    if (type === "PURCHASE" || type === "RETURN" || qty > 0) return "text-green-600 bg-green-50 border-green-200";
    if (type === "SALE" || type === "DAMAGE" || qty < 0) return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      <PageHeader 
        title="Stock History"
        description="Immutable ledger of all inventory transactions."
       
      />

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row justify-between gap-4">
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex flex-wrap gap-3">
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Product, Batch, or Notes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select 
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            >
              <option value="All">All Types</option>
              <option value="PURCHASE">Purchase</option>
              <option value="SALE">Sale</option>
              <option value="DAMAGE">Damage</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors">
            Apply
          </button>
        </form>

        <div className="flex items-center">
          <button 
            onClick={() => fetchMovements(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold text-sm rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <History className="w-12 h-12 text-slate-300 mb-4" />
            <p className="font-medium text-slate-700">No stock movements found.</p>
            <p className="text-sm mt-1">Try adjusting your date range or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Batch</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4 text-center">Change</th>
                  <th className="px-5 py-4 text-center">Ledger (Before &rarr; After)</th>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {movements.map((m: any) => (
                  <tr key={m._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                      {new Date(m.created_at).toLocaleString(undefined, { 
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {m.product?.name || "Unknown Product"}
                      {m.product?.strength && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{m.product.strength}</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {m.batch?.batch_number || m.batch_id}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-600">
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getMovementColor(m.movement_type, m.quantity)}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium bg-slate-50 px-3 py-1 rounded-md border border-slate-100 w-max mx-auto">
                        <span className="text-slate-500">{m.before_qty}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span className="text-slate-900 font-bold">{m.after_qty}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {m.user?.name || "System"}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs max-w-[200px] truncate" title={m.notes}>
                      {m.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination Controls */}
        {!isLoading && movements.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
