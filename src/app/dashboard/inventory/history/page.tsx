"use client";

import Swal from "@/lib/swal";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format, subDays, isValid } from "date-fns";
import { History, ArrowRight, Search, Download, ChevronLeft, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
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

  const [isExporting, setIsExporting] = useState(false);
  // Only the latest list request may update state (prevents stale responses overwriting newer filters)
  const listAbortRef = useRef<AbortController | null>(null);

  // Filters - Default to last 30 days so users see history immediately.
  // Local calendar dates (toISOString would give the UTC date, which is "yesterday" early morning east of UTC).
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysAgoStr = format(subDays(new Date(), 30), "yyyy-MM-dd");

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
    let controller: AbortController | null = null;
    if (exportMode) {
      if (isExporting) return;
      setIsExporting(true);
    } else {
      listAbortRef.current?.abort();
      controller = new AbortController();
      listAbortRef.current = controller;
    }
    try {
      if (!exportMode) {
        setIsLoading(true);
        setError("");
      }
      
      const params = {
        search: debouncedSearch,
        type,
        startDate,
        endDate,
        page,
        limit,
        export: exportMode
      };
      const res = await axios.get("/api/inventory/movements", { params, signal: controller?.signal });
      
      if (exportMode) {
        exportToCSV(res.data.data || []);
        if (res.data.truncated) {
          Swal.fire("Export Truncated", `Only the most recent ${res.data.maxExportRows} entries were exported. Narrow the date range to export the rest.`, "warning");
        }
      } else {
        setMovements(res.data.data || []);
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      }
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      if (!exportMode) {
        setError(err.response?.data?.error || "Failed to load stock movement history");
      } else {
        Swal.fire("Export Failed", "Failed to export stock movement ledger to CSV", "error");
      }
    } finally {
      if (exportMode) {
        setIsExporting(false);
      } else if (listAbortRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, type, startDate, endDate, debouncedSearch]); 

  useEffect(() => () => listAbortRef.current?.abort(), []);

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
    // escapeFormulae neutralises cells like "=HYPERLINK(...)" coming from user-entered notes/names (CSV injection)
    const csv = Papa.unparse(csvData, { escapeFormulae: true });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Stock_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Red if stock reduced, Green if stock added (status tone on text only)
  const getChangeTone = (qty: number) => {
    if (qty > 0) return "text-success";
    if (qty < 0) return "text-destructive";
    return "text-ink";
  };

  const getMovementBadgeVariant = (movementType: string, qty: number): "success" | "destructive" | "secondary" => {
    const t = (movementType || "").toUpperCase();
    if (t === "PURCHASE" || t === "RETURN" || (t === "ADJUSTMENT" && qty > 0)) {
      return "success";
    }
    if (t === "SALE" || t === "DAMAGE" || (t === "ADJUSTMENT" && qty < 0)) {
      return "destructive";
    }
    return "secondary";
  };

  const hasActiveFilters = search !== "" || type !== "All" || startDate !== thirtyDaysAgoStr || endDate !== todayStr;

  return (
    <PageShell>
      <PageHeader 
        title="Stock History"
        description="Immutable ledger of all inventory stock movements, adjustments, and transactions."
        actions={
          <Button 
            variant="outline" 
            onClick={() => fetchMovements(true)}
            disabled={isExporting}
            className="gap-2"
          >
            <Download aria-hidden="true" /> {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center w-full">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
          <Input 
            type="text" 
            placeholder="Search product, batch number, or notes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
          <Select 
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="w-[170px]"
          >
            <option value="All">All Types</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
            <option value="DAMAGE">Damage</option>
            <option value="RETURN">Return</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Input 
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="w-auto"
          />
          <span className="text-caption text-ink-48">to</span>
          <Input 
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="w-auto"
          />
        </div>

        {hasActiveFilters && (
          <Button 
            variant="link" 
            size="sm" 
            onClick={resetFilters}
            className="gap-1"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> Reset
          </Button>
        )}
      </div>

      {/* Stock History Table */}
      <Card className="overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={7} />
          </div>
        ) : movements.length === 0 ? (
          <EmptyState
            icon={History}
            title="No stock movements found"
            description={hasActiveFilters ? "Try adjusting or clearing your date range and search filters." : "No stock movements recorded in the ledger yet."}
            action={hasActiveFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            ) : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Change</TableHead>
                <TableHead className="text-center">Ledger (Before &rarr; After)</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m: any) => (
                <TableRow key={m._id}>
                  <TableCell className="whitespace-nowrap text-ink-48 tabular">
                    {safeFormatDate(m.created_at, "MMM dd, yyyy hh:mm a")}
                  </TableCell>
                  <TableCell className="font-semibold text-ink">
                    {m.product?.name || "Unknown Product"}
                    {m.product?.strength && (
                      <Badge variant="outline" className="ml-2 font-normal">
                        {m.product.strength}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-fine-print text-ink-48">
                    {m.batch?.batch_number || m.batch_id || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMovementBadgeVariant(m.movement_type, m.quantity)}>
                      {m.movement_type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-center tabular font-semibold ${getChangeTone(m.quantity)}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2 tabular w-max mx-auto">
                      <span className="text-ink-48">{m.before_qty ?? 0}</span>
                      <ArrowRight className="size-3 text-ink-48" aria-hidden="true" />
                      <span className="text-ink font-semibold">{m.after_qty ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-ink-48">
                    {m.user?.name || "System"}
                  </TableCell>
                  <TableCell className="text-ink-48 max-w-[200px] truncate" title={m.notes}>
                    {m.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {/* Pagination Controls */}
        {!isLoading && movements.length > 0 && (
          <div className="px-6 py-4 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-caption text-ink-48 tabular">
              Page <span className="font-semibold text-ink">{pagination.page}</span> of <span className="font-semibold text-ink">{pagination.totalPages === 0 ? 1 : pagination.totalPages}</span>
              <span className="ml-2">({pagination.total} total ledger entries)</span>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
              >
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <Button 
                variant="secondary"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || pagination.totalPages === 0}
              >
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
