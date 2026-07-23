"use client";

import { useState, useEffect } from "react";
import { format, isValid } from "date-fns";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { 
  Search, ChevronLeft, ChevronRight, Globe, MonitorSmartphone, History, 
  Eye, X, Shield, RefreshCw, Copy, Check, Code, User, Building2, Key, Clock
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

function safeFormatDate(dateVal: any, formatString: string): string {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    if (!isValid(d) || isNaN(d.getTime())) return "N/A";
    return format(d, formatString);
  } catch {
    return "N/A";
  }
}

function parseUserAgent(uaString?: string): string {
  if (!uaString || uaString === "System") return "System Process";
  const str = uaString.toLowerCase();
  
  let browser = "Browser";
  if (str.includes("firefox")) browser = "Firefox";
  else if (str.includes("edg")) browser = "Edge";
  else if (str.includes("chrome")) browser = "Chrome";
  else if (str.includes("safari")) browser = "Safari";

  let os = "Desktop";
  if (str.includes("mac")) os = "macOS";
  else if (str.includes("win")) os = "Windows";
  else if (str.includes("android")) os = "Android";
  else if (str.includes("iphone") || str.includes("ipad")) os = "iOS";
  else if (str.includes("linux")) os = "Linux";

  return `${browser} on ${os}`;
}

function getActionBadgeStyle(actionStr: string) {
  if (!actionStr) return "bg-slate-100 text-slate-800 border-slate-200";
  const action = actionStr.toUpperCase();
  if (action.includes("CREATE") || action.includes("ADD") || action.includes("LOGIN")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("PROFILE")) {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (action.includes("DELETE") || action.includes("LOGOUT") || action.includes("REMOVE")) {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (action.includes("SALE") || action.includes("POS") || action.includes("INVOICE")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  if (action.includes("REFUND") || action.includes("RETURN") || action.includes("ADJUST")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [actionFilter, setActionFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"formatted" | "json">("formatted");
  const [copied, setCopied] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
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
      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
      setTotalRecords(data.total || 0);
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, moduleFilter, debouncedSearch]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setActionFilter("ALL");
    setModuleFilter("ALL");
    setPage(1);
  };

  const handleCopyJson = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasActiveFilters = search !== "" || actionFilter !== "ALL" || moduleFilter !== "ALL";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Audit Logs"
        description="Monitor system activities, user actions, and security audit events."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full">
              {totalRecords} Total Log Entries
            </span>
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <History className="w-5 h-5" />
            </div>
          </div>
        }
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col shadow-xs">
        {/* Filters Header */}
        <div className="p-4 border-b border-border bg-secondary/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by user, action, module, IP..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Select 
              value={actionFilter} 
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} 
              className="w-full md:w-[150px] bg-background border-border text-foreground text-sm"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Creates</option>
              <option value="UPDATE">Updates</option>
              <option value="DELETE">Deletes</option>
              <option value="LOGIN">Logins</option>
              <option value="PROFILE">Profile</option>
              <option value="POS">POS Sales</option>
            </Select>

            <Select 
              value={moduleFilter} 
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} 
              className="w-full md:w-[180px] bg-background border-border text-foreground text-sm"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication</option>
              <option value="PRODUCTS">Products & Catalog</option>
              <option value="INVENTORY">Inventory</option>
              <option value="POS">Point of Sale</option>
              <option value="SUPPLIERS">Suppliers</option>
              <option value="USERS">Staff & Users</option>
            </Select>

            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Audit Logs Table */}
        {loading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={7} />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-muted-foreground mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No activity logs found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {hasActiveFilters ? "Try clearing or adjusting your search filters." : "No system audit events recorded yet."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Search Filters
              </Button>
            )}
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
                  <th className="p-4 text-sm font-semibold text-foreground">Device & IP</th>
                  <th className="p-4 text-sm font-semibold text-foreground text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="p-4 whitespace-nowrap">
                      <p className="font-medium text-sm text-foreground">
                        {safeFormatDate(log.timestamp, "MMM dd, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {safeFormatDate(log.timestamp, "hh:mm:ss a")}
                      </p>
                    </td>

                    <td className="p-4">
                      {log.user_info ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {log.user_info.name ? log.user_info.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground">{log.user_info.name || "Unknown User"}</p>
                            <p className="text-xs text-muted-foreground">{log.user_info.email || ""}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                            S
                          </div>
                          <span className="text-muted-foreground italic text-sm">System Process</span>
                        </div>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${getActionBadgeStyle(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border">
                        {log.module || "SYSTEM"}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.ip || "Unknown IP"}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title={log.browser || ""}>
                          <MonitorSmartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{parseUserAgent(log.browser)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setActiveTab("formatted");
                        }}
                        className="h-8 px-2.5 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                        title="View Full Audit Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border bg-secondary/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-medium">
            Page <span className="font-bold text-foreground">{page}</span> of <span className="font-bold text-foreground">{totalPages === 0 ? 1 : totalPages}</span>
            <span className="ml-2 font-normal text-muted-foreground">({totalRecords} logs)</span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 text-xs font-medium"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs font-medium"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Inspect Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-secondary/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    Audit Log Inspection
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border ${getActionBadgeStyle(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">Log ID: {selectedLog._id}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="h-8 text-xs gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied JSON" : "Copy JSON"}</span>
                </Button>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-border bg-secondary/20 flex gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab("formatted")}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "formatted" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Formatted Overview
              </button>
              <button
                onClick={() => setActiveTab("json")}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === "json" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Full Raw JSON
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {activeTab === "formatted" ? (
                <>
                  {/* System & Identity Identifiers */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-primary" /> Identifiers & Scope
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-secondary/20 border border-border text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Log Entry ID</span>
                        <span className="font-mono text-xs font-bold text-foreground break-all">{selectedLog._id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">User ID</span>
                        <span className="font-mono text-xs font-bold text-foreground break-all">{selectedLog.user_id || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Tenant ID</span>
                        <span className="font-mono text-xs font-bold text-foreground break-all">{selectedLog.tenant_id || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* User Account Info */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" /> User Profile Information
                    </h4>
                    {selectedLog.user_info ? (
                      <div className="p-4 rounded-lg bg-secondary/20 border border-border space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {selectedLog.user_info.name ? selectedLog.user_info.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-foreground">{selectedLog.user_info.name}</h5>
                            <p className="text-xs text-muted-foreground">{selectedLog.user_info.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border/50 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">User Role</span>
                            <span className="font-bold text-foreground uppercase">{selectedLog.user_info.role || "CASHIER"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Role ID</span>
                            <span className="font-mono text-[11px] text-muted-foreground truncate block">{selectedLog.user_info.role_id || "Standard"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Account Created</span>
                            <span className="text-muted-foreground text-[11px]">{safeFormatDate(selectedLog.user_info.created_at, "yyyy-MM-dd")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Last Profile Update</span>
                            <span className="text-muted-foreground text-[11px]">{safeFormatDate(selectedLog.user_info.updated_at, "yyyy-MM-dd")}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-secondary/20 border border-border text-xs flex items-center gap-2 text-muted-foreground italic">
                        <Building2 className="w-4 h-4" /> System automated task (No associated user account)
                      </div>
                    )}
                  </div>

                  {/* Network & Event Context */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Event Context
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-secondary/20 border border-border text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Action</span>
                        <span className="font-bold text-foreground">{selectedLog.action}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Module</span>
                        <span className="font-bold text-foreground">{selectedLog.module}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                        <span className="text-foreground font-bold">{safeFormatDate(selectedLog.timestamp, "yyyy-MM-dd HH:mm:ss")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">IP Address</span>
                        <span className="text-foreground font-bold">{selectedLog.ip || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* User-Agent String */}
                  {selectedLog.browser && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Browser & Client Device</label>
                      <div className="p-3 bg-secondary/30 rounded-md border border-border text-[11px] text-muted-foreground break-all">
                        {selectedLog.browser}
                      </div>
                    </div>
                  )}

                  {/* Log Details / Message */}
                  {selectedLog.details && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Details</label>
                      <div className="p-3 bg-secondary/30 rounded-md border border-border text-xs text-foreground">
                        {typeof selectedLog.details === "object" ? JSON.stringify(selectedLog.details, null, 2) : String(selectedLog.details)}
                      </div>
                    </div>
                  )}

                  {/* Before State */}
                  {selectedLog.before && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider">State Before Change</label>
                      <pre className="p-3 bg-rose-50/50 border border-rose-200 rounded-md font-mono text-[11px] text-rose-900 overflow-x-auto">
                        {JSON.stringify(selectedLog.before, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* After State */}
                  {selectedLog.after && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">State After Change</label>
                      <pre className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-md font-mono text-[11px] text-emerald-900 overflow-x-auto">
                        {JSON.stringify(selectedLog.after, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                /* Raw Complete JSON View */
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider font-mono">
                      Complete Payload Object
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {JSON.stringify(selectedLog).length} bytes
                    </span>
                  </div>
                  <pre className="p-4 bg-slate-950 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-secondary/20 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Pharmacy POS Audit Logging System
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
