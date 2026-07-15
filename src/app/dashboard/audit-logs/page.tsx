"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Loader2, Search, ChevronLeft, ChevronRight, Activity, Globe, MonitorSmartphone, History } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [actionFilter, setActionFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      });
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (moduleFilter !== "ALL") params.append("module", moduleFilter);
      if (debouncedSearch) params.append("search", debouncedSearch);
      
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, moduleFilter, debouncedSearch]);

  const getActionColor = (action: string) => {
    if (action.includes("CREATE") || action.includes("LOGIN")) return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    if (action.includes("UPDATE") || action.includes("EDIT")) return "bg-sky-100 text-sky-800 border border-sky-200";
    if (action.includes("DELETE") || action.includes("LOGOUT")) return "bg-rose-100 text-rose-800 border border-rose-200";
    if (action.includes("SALE")) return "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200";
    return "bg-slate-100 text-slate-800 border border-slate-200";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Audit Logs"
        description="Monitor system activities, user actions, and security events."
        actions={
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <History className="w-5 h-5" />
          </div>
        }
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-secondary/30 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by user or action..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div className="flex gap-3">
            <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-full md:w-[150px] bg-background border-border text-foreground text-sm">
              <option value="ALL">All Actions</option>
              <option value="CREATE">Creates</option>
              <option value="UPDATE">Updates</option>
              <option value="DELETE">Deletes</option>
              <option value="LOGIN">Logins</option>
            </Select>
            <Select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} className="w-full md:w-[180px] bg-background border-border text-foreground text-sm">
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication</option>
              <option value="PRODUCTS">Products & Catalog</option>
              <option value="INVENTORY">Inventory</option>
              <option value="POS">Point of Sale</option>
              <option value="SUPPLIERS">Suppliers</option>
              <option value="USERS">Staff & Users</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
             <TableSkeleton columns={5} rows={6} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No activity logs found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Try adjusting your filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Timestamp</th>
                  <th className="p-4 text-sm font-semibold text-foreground">User</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Action</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Module</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Client Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="p-4 whitespace-nowrap">
                      <p className="font-medium text-sm text-foreground">{format(new Date(log.timestamp), "MMM dd, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(log.timestamp), "hh:mm:ss a")}</p>
                    </td>
                    <td className="p-4">
                      {log.user_info ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {log.user_info.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{log.user_info.name}</p>
                            <p className="text-xs text-muted-foreground">{log.user_info.email}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold text-xs">
                             S
                           </div>
                           <span className="text-muted-foreground italic text-sm">System Process</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono uppercase tracking-wider ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border">
                        {log.module}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                         <div className="flex items-center gap-1.5">
                           <Globe className="w-3.5 h-3.5" /> 
                           <span className="truncate">{log.ip}</span>
                         </div>
                         <div className="flex items-center gap-1.5 max-w-[200px]" title={log.browser}>
                           <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" /> 
                           <span className="truncate">{log.browser}</span>
                         </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-border bg-secondary/30 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages === 0 ? 1 : totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
