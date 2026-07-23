"use client";

import { useState, useEffect, useCallback } from "react";
import { format, isValid } from "date-fns";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { 
  ActivitySquare, Search, ChevronLeft, ChevronRight, Globe, MonitorSmartphone, 
  Eye, X, Shield, RefreshCw, Copy, Check, Code, User, Building2, Key, Clock,
  Filter, Zap, ShieldAlert, CheckCircle2, FileText, AlertCircle
} from "lucide-react";

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
  if (!actionStr) return "bg-muted text-muted-foreground border-border";
  const action = actionStr.toUpperCase();
  if (action.includes("CREATE") || action.includes("ADD") || action.includes("REGISTER") || action.includes("ACTIVATED")) {
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  }
  if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("PROFILE")) {
    return "bg-sky-500/10 text-sky-600 border-sky-500/20";
  }
  if (action.includes("DELETE") || action.includes("LOGOUT") || action.includes("REMOVE") || action.includes("ERROR")) {
    return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  }
  if (action.includes("LOGIN") || action.includes("PASSWORD") || action.includes("AUTH") || action.includes("SECURITY")) {
    return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
  }
  return "bg-secondary text-secondary-foreground border-border";
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20"
      });
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (moduleFilter !== "ALL") params.append("module", moduleFilter);
      if (debouncedSearch) params.append("search", debouncedSearch);

      const res = await fetch(`/api/account/activity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load activity logs");

      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
      setTotalRecords(data.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, moduleFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  // Calculate summary counts from current dataset
  const securityCount = logs.filter(l => {
    const act = (l.action || "").toUpperCase();
    return act.includes("LOGIN") || act.includes("PASSWORD") || act.includes("AUTH") || act.includes("SECURITY");
  }).length;

  const userActionCount = logs.filter(l => Boolean(l.user_info)).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" /> System Audit & Security
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor real-time system events, administrative changes, and user actions within your store.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Logged Events</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalRecords}</p>
          <p className="text-[11px] text-muted-foreground">Recorded across all modules</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Security & Auth</span>
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">{securityCount}</p>
          <p className="text-[11px] text-muted-foreground">Logins, password & auth events</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Staff / User Actions</span>
            <User className="w-4 h-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold text-sky-600">{userActionCount}</p>
          <p className="text-[11px] text-muted-foreground">Events performed by users</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>System Status</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-semibold text-emerald-600">Active Logging</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Real-time event capture active</p>
        </div>
      </div>

      {/* Controls & Table Container */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-2xs">
        {/* Filters Bar */}
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by action, user, IP, or details..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
            {search && (
              <button 
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Select 
              value={actionFilter} 
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} 
              className="w-full md:w-[160px] bg-background border-border text-foreground text-sm"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">Creates / Adds</option>
              <option value="UPDATE">Updates / Edits</option>
              <option value="DELETE">Deletes</option>
              <option value="LOGIN">Auth / Logins</option>
              <option value="PASSWORD">Password Events</option>
              <option value="ERROR">System Errors</option>
            </Select>

            <Select 
              value={moduleFilter} 
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} 
              className="w-full md:w-[170px] bg-background border-border text-foreground text-sm"
            >
              <option value="ALL">All Modules</option>
              <option value="AUTH">Authentication</option>
              <option value="PRODUCTS">Products & Catalog</option>
              <option value="INVENTORY">Inventory</option>
              <option value="POS">Point of Sale</option>
              <option value="USERS">Staff & Users</option>
              <option value="ROLES">Permissions & Roles</option>
              <option value="SETTINGS">Settings</option>
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
              <ActivitySquare className="w-8 h-8 opacity-40" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No activity logs found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {hasActiveFilters ? "No log entries match your current search filters." : "No activity events logged in this tenant yet."}
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
                <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Performed By</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Module</th>
                  <th className="p-4">Device & IP</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log._id || Math.random()} className="hover:bg-muted/30 transition-colors group">
                    {/* Timestamp */}
                    <td className="p-4 whitespace-nowrap">
                      <p className="font-medium text-sm text-foreground">
                        {safeFormatDate(log.timestamp, "MMM dd, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {safeFormatDate(log.timestamp, "hh:mm:ss a")}
                      </p>
                    </td>

                    {/* User / Performed By */}
                    <td className="p-4">
                      {log.user_info ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {log.user_info.name ? log.user_info.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground leading-snug">
                              {log.user_info.name || "User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{log.user_info.email || ""}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                            S
                          </div>
                          <span className="text-muted-foreground italic text-xs">System Process</span>
                        </div>
                      )}
                    </td>

                    {/* Action Badge */}
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${getActionBadgeStyle(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Module Tag */}
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-muted text-foreground border border-border">
                        {log.module || "SYSTEM"}
                      </span>
                    </td>

                    {/* Device & IP */}
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Globe className="w-3.5 h-3.5 text-muted-foreground/70" />
                          <span>{log.ip || "Unknown IP"}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title={log.browser || ""}>
                          <MonitorSmartphone className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                          <span className="truncate max-w-[180px]">{parseUserAgent(log.browser)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Inspect Button */}
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setActiveTab("formatted");
                        }}
                        className="h-8 px-2.5 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
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
        <div className="p-4 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground font-medium">
            Page <span className="font-bold text-foreground">{page}</span> of <span className="font-bold text-foreground">{totalPages === 0 ? 1 : totalPages}</span>
            <span className="ml-2 font-normal text-muted-foreground">({totalRecords} total log entries)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 text-xs font-medium gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs font-medium gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Inspect Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    Log Entry Details
                    <span className={`px-2.5 py-0.5 rounded text-xs border ${getActionBadgeStyle(selectedLog.action)}`}>
                      {selectedLog.action}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">ID: {selectedLog._id || "N/A"}</p>
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
                  <span>{copied ? "Copied" : "Copy JSON"}</span>
                </Button>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 border-b border-border bg-muted/20 flex gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveTab("formatted")}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeTab === "formatted" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Formatted Overview
              </button>
              <button
                onClick={() => setActiveTab("json")}
                className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
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
                  {/* System & Identifiers */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-primary" /> Scope & Identifiers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Log Entry ID</span>
                        <span className="font-mono text-xs font-semibold text-foreground break-all">{selectedLog._id || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">User ID</span>
                        <span className="font-mono text-xs font-semibold text-foreground break-all">{selectedLog.user_id || selectedLog.userId || "System"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Tenant ID</span>
                        <span className="font-mono text-xs font-semibold text-foreground break-all">{selectedLog.tenant_id || selectedLog.tenantId || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* User Info */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" /> Performed By User
                    </h4>
                    {selectedLog.user_info ? (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {selectedLog.user_info.name ? selectedLog.user_info.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-foreground">{selectedLog.user_info.name}</h5>
                            <p className="text-xs text-muted-foreground">{selectedLog.user_info.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border/50 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">User Role</span>
                            <span className="font-semibold text-foreground uppercase">{selectedLog.user_info.role || "CASHIER"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Account Created</span>
                            <span className="text-muted-foreground text-[11px]">{safeFormatDate(selectedLog.user_info.created_at, "yyyy-MM-dd")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Last Updated</span>
                            <span className="text-muted-foreground text-[11px]">{safeFormatDate(selectedLog.user_info.updated_at, "yyyy-MM-dd")}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-muted/30 border border-border text-xs flex items-center gap-2 text-muted-foreground italic">
                        <Building2 className="w-4 h-4" /> System automated task (No associated user account)
                      </div>
                    )}
                  </div>

                  {/* Context */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Event Context
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-muted/30 border border-border text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Action</span>
                        <span className="font-bold text-foreground">{selectedLog.action}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Module</span>
                        <span className="font-bold text-foreground">{selectedLog.module || "SYSTEM"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                        <span className="text-foreground font-bold">{safeFormatDate(selectedLog.timestamp, "yyyy-MM-dd HH:mm:ss")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">IP Address</span>
                        <span className="text-foreground font-bold font-mono">{selectedLog.ip || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  {/* User Agent */}
                  {selectedLog.browser && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Browser & Client Device</label>
                      <div className="p-3 bg-muted/30 rounded-md border border-border text-xs text-muted-foreground font-mono break-all">
                        {selectedLog.browser}
                      </div>
                    </div>
                  )}

                  {/* Log Details */}
                  {selectedLog.details && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Details</label>
                      <div className="p-3 bg-muted/30 rounded-md border border-border text-xs text-foreground font-mono overflow-x-auto">
                        {typeof selectedLog.details === "object" ? JSON.stringify(selectedLog.details, null, 2) : String(selectedLog.details)}
                      </div>
                    </div>
                  )}

                  {/* Before State */}
                  {selectedLog.before && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-rose-600 uppercase tracking-wider">State Before Change</label>
                      <pre className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md font-mono text-xs text-rose-600 overflow-x-auto">
                        {JSON.stringify(selectedLog.before, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* After State */}
                  {selectedLog.after && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">State After Change</label>
                      <pre className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md font-mono text-xs text-emerald-600 overflow-x-auto">
                        {JSON.stringify(selectedLog.after, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                /* Raw JSON View */
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
            <div className="p-4 border-t border-border bg-muted/40 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                Pharmacy POS Security & Audit Logging
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

