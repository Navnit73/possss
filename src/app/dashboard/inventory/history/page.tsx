"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import axios from "axios";
import { format, subDays, isValid } from "date-fns";
import { History, ArrowRight, Search, Download, ChevronLeft, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import Papa from "papaparse";

function safeFormatDate(dateVal: any, formatString = "MMM dd, yyyy hh:mm a"): string {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    if (!isValid(d) || isNaN(d.getTime())) return "N/A";
    return format(d, formatString);
  } catch {
    return "N/A";
  }
}

export default function StockHistoryPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters - Default to last 30 days so users see history immediately
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = subDays(new Date(), 30).toISOString().split('T')[0];

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("All");
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchMovements = async (exportMode = false) => {
    try {
      if (!exportMode) setIsLoading(true);
      setError("");
      
      const params = {
        search: debouncedSearch,
        type,
        startDate,
        endDate,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/inventory/movements", { params });
      
      if (exportMode) {
        exportToCSV(res.data.data || []);
      } else {
        setMovements(res.data.data || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      }
    } catch (err: any) {
      if (!exportMode) {
        setError(err.response?.data?.error || "Failed to load stock movement history");
      } else {
        Swal.fire("Export Failed", "Failed to export stock movement ledger to CSV", "error");
      }
    } finally {
      if (!exportMode) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, type, startDate, endDate, debouncedSearch]); 

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setType("All");
    setStartDate(thirtyDaysAgoStr);
    setEndDate(todayStr);
    setPage(1);
  };

  const exportToCSV = (exportData: any[]) => {
    const csvData = exportData.map(item => ({
      "Date": safeFormatDate(item.created_at, "yyyy-MM-dd HH:mm:ss"),
      "Product": item.product?.name || "Unknown Product",
      "Batch": item.batch?.batch_number || item.batch_id || "N/A",
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

  // Red if stock reduced, Green if stock added
  const getChangeBadgeStyle = (qty: number) => {
    if (qty > 0) return "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold";
    if (qty < 0) return "bg-rose-100 text-rose-800 border-rose-200 font-bold";
    return "bg-slate-100 text-slate-800 border-slate-200 font-bold";
  };

  const getMovementBadgeStyle = (movementType: string, qty: number) => {
    const t = (movementType || "").toUpperCase();
    if (t === "PURCHASE" || t === "RETURN" || (t === "ADJUSTMENT" && qty > 0)) {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (t === "SALE" || t === "DAMAGE" || (t === "ADJUSTMENT" && qty < 0)) {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const hasActiveFilters = search !== "" || type !== "All" || startDate !== thirtyDaysAgoStr || endDate !== todayStr;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Stock History"
        description="Immutable ledger of all inventory stock movements, adjustments, and transactions."
        actions={
          <Button 
            variant="outline" 
            onClick={() => fetchMovements(true)}
            className="cursor-pointer gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      {error && <div className="p-4 text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-200">{error}</div>}

      {/* Filters Container */}
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex-1 max-w-4xl flex flex-wrap gap-3 items-center w-full">
          
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Search product, batch number, or notes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select 
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="w-[140px] text-sm"
            >
              <option value="All">All Types</option>
              <option value="PURCHASE">Purchase</option>
              <option value="SALE">Sale</option>
              <option value="DAMAGE">Damage</option>
              <option value="RETURN">Return</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="text-xs"
            />
            <span className="text-muted-foreground text-xs font-medium">to</span>
            <Input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="text-xs"
            />
          </div>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Stock History Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={7} />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center">
            <History className="w-12 h-12 text-muted-foreground mb-3 opacity-60" />
            <h3 className="font-bold text-foreground text-base mb-1">No stock movements found</h3>
            <p className="text-sm max-w-sm">
              {hasActiveFilters ? "Try adjusting or clearing your date range and search filters." : "No stock movements recorded in the ledger yet."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Date</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Product</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Batch</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Type</th>
                  <th className="p-4 text-sm font-semibold text-foreground text-center">Change</th>
                  <th className="p-4 text-sm font-semibold text-foreground text-center">Ledger (Before &rarr; After)</th>
                  <th className="p-4 text-sm font-semibold text-foreground">User</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m: any) => (
                  <tr key={m._id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">
                      {safeFormatDate(m.created_at, "MMM dd, yyyy hh:mm a")}
                    </td>
                    <td className="p-4 font-semibold text-foreground">
                      {m.product?.name || "Unknown Product"}
                      {m.product?.strength && (
                        <span className="ml-2 text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                          {m.product.strength}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">
                      {m.batch?.batch_number || m.batch_id || "N/A"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getMovementBadgeStyle(m.movement_type, m.quantity)}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold border ${getChangeBadgeStyle(m.quantity)}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium bg-secondary/50 px-3 py-1 rounded-md border border-border w-max mx-auto">
                        <span className="text-muted-foreground">{m.before_qty ?? 0}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-foreground font-bold">{m.after_qty ?? 0}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs font-medium">
                      {m.user?.name || "System"}
                    </td>
                    <td className="p-4 text-muted-foreground text-xs max-w-[200px] truncate" title={m.notes}>
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
          <div className="p-4 border-t border-border bg-secondary/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground font-medium">
              Page <span className="font-bold text-foreground">{pagination.page}</span> of <span className="font-bold text-foreground">{pagination.totalPages === 0 ? 1 : pagination.totalPages}</span>
              <span className="ml-2 font-normal text-muted-foreground">({pagination.total} total ledger entries)</span>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="h-8 text-xs font-medium"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || pagination.totalPages === 0}
                className="h-8 text-xs font-medium"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
