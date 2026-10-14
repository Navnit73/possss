"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, isValid } from "date-fns";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState, StatCard, Chip } from "@/components/ui/Page";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { 
  ActivitySquare, Search, ChevronLeft, ChevronRight, Globe, MonitorSmartphone, 
  Eye, X, RefreshCw, Copy, Check, Code, User, Building2, Key, Clock,
  Zap, ShieldAlert, FileText
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


// Status is carried by text tone only (Badge), never by tinted fills
function getActionBadgeVariant(actionStr: string): BadgeProps["variant"] {
  if (!actionStr) return "outline";
  const action = actionStr.toUpperCase();
  if (action.includes("CREATE") || action.includes("ADD") || action.includes("REGISTER") || action.includes("ACTIVATED")) {
    return "success";
  }
  if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("PROFILE")) {
    return "secondary";
  }
  if (action.includes("DELETE") || action.includes("LOGOUT") || action.includes("REMOVE") || action.includes("ERROR")) {
    return "destructive";
  }
  if (action.includes("LOGIN") || action.includes("PASSWORD") || action.includes("AUTH") || action.includes("SECURITY")) {
    return "secondary";
  }
  return "outline";
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

  // Only the latest request may update the table (a slow earlier response must not overwrite newer filters)
  const requestId = useRef(0);

  const fetchLogs = useCallback(async () => {
    const id = ++requestId.current;
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
      if (id !== requestId.current) return;

      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
      setTotalRecords(data.total || 0);
    } catch (err: any) {
      if (id !== requestId.current) return;
      setError(err.message || "Failed to load activity logs");
    } finally {
      if (id === requestId.current) setLoading(false);
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
    <PageShell>
      <PageHeader
        title="Activity Logs"
        description="Monitor real-time system events, administrative changes, and user actions within your store."
        actions={
          <Button
            variant="outline"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh Logs
          </Button>
        }
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <p>{error}</p>
        </Alert>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Logged Events"
          value={totalRecords}
          hint="Recorded across all modules"
          icon={FileText}
        />
        <StatCard
          label="Security & Auth"
          value={securityCount}
          hint="Logins, password & auth events"
          icon={ShieldAlert}
        />
        <StatCard
          label="Staff / User Actions"
          value={userActionCount}
          hint="Events performed by users"
          icon={User}
        />
        <StatCard
          label="System Status"
          value="Active"
          tone="success"
          hint="Real-time event capture active"
          icon={Zap}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 justify-between md:items-center">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
          <Input 
            type="text" 
            placeholder="Search by action, user, IP, or details..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-11"
            aria-label="Search activity logs"
          />
          {search && (
            <button 
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="press cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 size-7 rounded-full flex items-center justify-center text-ink-48"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Select 
            value={actionFilter} 
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} 
            className="w-full md:w-48"
            aria-label="Filter by action"
          >
            <option value="ALL">All Actions</option>
            <option value="CREATE">Creates / Adds</option>
            <option value="UPDATE">Updates / Edits</option>
            <option value="DELETE">Deletes</option>
            <option value="LOGIN">Auth / Logins</option>
            <option value="PASSWORD">Password Events</option>
            <option value="SUBSCRIPTION">Subscription Events</option>
            <option value="ERROR">System Errors</option>
          </Select>

          <Select 
            value={moduleFilter} 
            onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} 
            className="w-full md:w-52"
            aria-label="Filter by module"
          >
            <option value="ALL">All Modules</option>
            <option value="AUTH">Authentication</option>
            <option value="PRODUCTS">Products & Catalog</option>
            <option value="INVENTORY">Inventory</option>
            <option value="POS">Point of Sale</option>
            <option value="USERS">Staff & Users</option>
            <option value="ROLES">Permissions & Roles</option>
            <option value="SETTINGS">Settings</option>
            <option value="BILLING">Billing & Subscription</option>
            <option value="SECURITY">Security</option>
          </Select>

          {hasActiveFilters && (
            <Chip onClick={resetFilters}>
              <RefreshCw aria-hidden="true" /> Reset
            </Chip>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {/* Activity Logs Table */}
        {loading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={7} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ActivitySquare}
            title="No activity logs found"
            description={hasActiveFilters ? "No log entries match your current search filters." : "No activity events logged in this tenant yet."}
            action={hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Search Filters
              </Button>
            ) : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Device & IP</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log._id}>
                  {/* Timestamp */}
                  <TableCell className="whitespace-nowrap">
                    <p className="text-caption font-semibold text-ink tabular">
                      {safeFormatDate(log.timestamp, "MMM dd, yyyy")}
                    </p>
                    <p className="text-fine-print text-ink-48 tabular mt-1">
                      {safeFormatDate(log.timestamp, "hh:mm:ss a")}
                    </p>
                  </TableCell>

                  {/* User / Performed By */}
                  <TableCell>
                    {log.user_info ? (
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-chip/64 flex items-center justify-center text-ink font-semibold text-fine-print shrink-0">
                          {log.user_info.name ? log.user_info.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-caption font-semibold text-ink">
                            {log.user_info.name || "User"}
                          </p>
                          <p className="text-fine-print text-ink-48 mt-1">{log.user_info.email || ""}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-chip/64 flex items-center justify-center text-ink-48 font-semibold text-fine-print shrink-0">
                          S
                        </div>
                        <span className="text-caption text-ink-48 italic">System Process</span>
                      </div>
                    )}
                  </TableCell>

                  {/* Action Badge */}
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>

                  {/* Module Tag */}
                  <TableCell>
                    <Badge variant="outline">
                      {log.module || "SYSTEM"}
                    </Badge>
                  </TableCell>

                  {/* Device & IP */}
                  <TableCell>
                    <div className="flex flex-col gap-1 text-fine-print text-ink-48">
                      <div className="flex items-center gap-1.5">
                        <Globe className="size-3.5 text-ink-48 shrink-0" aria-hidden="true" />
                        <span className="tabular">{log.ip || "Unknown IP"}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title={log.browser || ""}>
                        <MonitorSmartphone className="size-3.5 text-ink-48 shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-44">{parseUserAgent(log.browser)}</span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Inspect Button */}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedLog(log);
                        setActiveTab("formatted");
                      }}
                    >
                      <Eye aria-hidden="true" />
                      <span>Inspect</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-caption text-ink-48 tabular">
            Page <span className="font-semibold text-ink">{page}</span> of <span className="font-semibold text-ink">{totalPages === 0 ? 1 : totalPages}</span>
            <span className="ml-2">({totalRecords} total log entries)</span>
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft aria-hidden="true" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Inspect Log Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        className="max-w-3xl"
        title={
          selectedLog && (
            <span className="flex flex-wrap items-center gap-2">
              Log Entry Details
              <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                {selectedLog.action}
              </Badge>
            </span>
          )
        }
        description={selectedLog && <span className="font-mono break-all">ID: {selectedLog._id || "N/A"}</span>}
      >
        {selectedLog && (
          <div className="space-y-6">
            {/* Tabs + copy */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Chip
                  selected={activeTab === "formatted"}
                  onClick={() => setActiveTab("formatted")}
                >
                  <Eye aria-hidden="true" />
                  Formatted Overview
                </Chip>
                <Chip
                  selected={activeTab === "json"}
                  onClick={() => setActiveTab("json")}
                >
                  <Code aria-hidden="true" />
                  Full Raw JSON
                </Chip>
              </div>
              <Button variant="secondary" onClick={handleCopyJson}>
                {copied ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </Button>
            </div>

            {/* Modal Body */}
            <div className="space-y-6">
              {activeTab === "formatted" ? (
                <>
                  {/* System & Identifiers */}
                  <section>
                    <h4 className="text-body font-semibold text-ink mb-3 flex items-center gap-2">
                      <Key className="size-4 text-ink-48" aria-hidden="true" /> Scope & Identifiers
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-parchment">
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">Log Entry ID</span>
                        <span className="font-mono text-caption font-semibold text-ink break-all">{selectedLog._id || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">User ID</span>
                        <span className="font-mono text-caption font-semibold text-ink break-all">{selectedLog.user_id || selectedLog.userId || "System"}</span>
                      </div>
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">Tenant ID</span>
                        <span className="font-mono text-caption font-semibold text-ink break-all">{selectedLog.tenant_id || selectedLog.tenantId || "N/A"}</span>
                      </div>
                    </div>
                  </section>

                  {/* User Info */}
                  <section>
                    <h4 className="text-body font-semibold text-ink mb-3 flex items-center gap-2">
                      <User className="size-4 text-ink-48" aria-hidden="true" /> Performed By User
                    </h4>
                    {selectedLog.user_info ? (
                      <div className="p-4 rounded-lg bg-parchment space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-chip/64 flex items-center justify-center text-ink font-semibold text-caption">
                            {selectedLog.user_info.name ? selectedLog.user_info.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <h5 className="text-caption font-semibold text-ink">{selectedLog.user_info.name}</h5>
                            <p className="text-fine-print text-ink-48 mt-1">{selectedLog.user_info.email}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-hairline">
                          <div>
                            <span className="text-fine-print text-ink-48 block mb-1">User Role</span>
                            <span className="text-caption font-semibold text-ink">{selectedLog.user_info.role || "CASHIER"}</span>
                          </div>
                          <div>
                            <span className="text-fine-print text-ink-48 block mb-1">Account Created</span>
                            <span className="text-caption text-ink-80 tabular">{safeFormatDate(selectedLog.user_info.created_at, "yyyy-MM-dd")}</span>
                          </div>
                          <div>
                            <span className="text-fine-print text-ink-48 block mb-1">Last Updated</span>
                            <span className="text-caption text-ink-80 tabular">{safeFormatDate(selectedLog.user_info.updated_at, "yyyy-MM-dd")}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-parchment text-caption flex items-center gap-2 text-ink-48 italic">
                        <Building2 className="size-4" aria-hidden="true" /> System automated task (No associated user account)
                      </div>
                    )}
                  </section>

                  {/* Context */}
                  <section>
                    <h4 className="text-body font-semibold text-ink mb-3 flex items-center gap-2">
                      <Clock className="size-4 text-ink-48" aria-hidden="true" /> Event Context
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-parchment">
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">Action</span>
                        <span className="text-caption font-semibold text-ink">{selectedLog.action}</span>
                      </div>
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">Module</span>
                        <span className="text-caption font-semibold text-ink">{selectedLog.module || "SYSTEM"}</span>
                      </div>
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">Timestamp</span>
                        <span className="text-caption font-semibold text-ink tabular">{safeFormatDate(selectedLog.timestamp, "yyyy-MM-dd HH:mm:ss")}</span>
                      </div>
                      <div>
                        <span className="text-fine-print text-ink-48 block mb-1">IP Address</span>
                        <span className="text-caption font-semibold text-ink tabular">{selectedLog.ip || "N/A"}</span>
                      </div>
                    </div>
                  </section>

                  {/* User Agent */}
                  {selectedLog.browser && (
                    <section className="space-y-2">
                      <p className="text-caption font-semibold text-ink">Browser & Client Device</p>
                      <div className="p-4 bg-parchment rounded-lg text-fine-print leading-relaxed text-ink-80 break-all">
                        {selectedLog.browser}
                      </div>
                    </section>
                  )}

                  {/* Log Details */}
                  {selectedLog.details && (
                    <section className="space-y-2">
                      <p className="text-caption font-semibold text-ink">Event Details</p>
                      <div className="p-4 bg-parchment rounded-lg text-caption text-ink overflow-x-auto">
                        {typeof selectedLog.details === "object" ? JSON.stringify(selectedLog.details, null, 2) : String(selectedLog.details)}
                      </div>
                    </section>
                  )}

                  {/* Before State */}
                  {selectedLog.before && (
                    <section className="space-y-2">
                      <p className="text-caption font-semibold text-destructive">State Before Change</p>
                      <pre className="p-4 bg-parchment rounded-lg font-mono text-fine-print leading-relaxed text-ink-80 overflow-x-auto">
                        {JSON.stringify(selectedLog.before, null, 2)}
                      </pre>
                    </section>
                  )}

                  {/* After State */}
                  {selectedLog.after && (
                    <section className="space-y-2">
                      <p className="text-caption font-semibold text-success">State After Change</p>
                      <pre className="p-4 bg-parchment rounded-lg font-mono text-fine-print leading-relaxed text-ink-80 overflow-x-auto">
                        {JSON.stringify(selectedLog.after, null, 2)}
                      </pre>
                    </section>
                  )}
                </>
              ) : (
                /* Raw JSON View */
                <section className="space-y-2">
                  <div className="flex justify-between items-center gap-3">
                    <p className="text-caption font-semibold text-ink">
                      Complete Payload Object
                    </p>
                    <span className="text-fine-print text-ink-48 tabular">
                      {JSON.stringify(selectedLog).length} bytes
                    </span>
                  </div>
                  <pre className="p-4 bg-parchment text-ink-80 rounded-lg font-mono text-fine-print leading-relaxed overflow-x-auto">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </section>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-hairline flex justify-between items-center gap-3">
              <span className="text-caption text-ink-48">
                Medishelf POS Security & Audit Logging
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
