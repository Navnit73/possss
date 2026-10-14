"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { 
  FileText, 
  Eye, 
  Printer, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  UserCircle, 
  Filter, 
  RotateCcw,
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  Banknote
} from "lucide-react";
import { PageShell, StatCard, EmptyState } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { InvoiceReceiptModal } from "@/components/pos/InvoiceReceiptModal";
import { useCurrency } from "@/context/CurrencyContext";

export default function PosInvoicesPage() {
  const { formatCurrency } = useCurrency();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Date Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 100;

  useEffect(() => {
    // Typing in the search box fires several requests: abort the older ones so a slow, stale response can't overwrite newer results
    const controller = new AbortController();
    const fetchInvoices = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const res = await axios.get("/api/pos/invoices", {
          params: {
            page,
            limit,
            q: search,
            startDate: appliedStartDate,
            endDate: appliedEndDate
          },
          signal: controller.signal,
        });

        if (res.data.invoices) {
          setInvoices(res.data.invoices);
          setTotalPages(res.data.totalPages || 1);
          setTotalCount(res.data.total || 0);
        } else {
          setInvoices(res.data);
          setTotalCount(res.data.length);
          setTotalPages(1);
        }
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        console.error("Failed to fetch invoices", err);
        setInvoices([]);
        setLoadError(err.response?.data?.error || "Couldn't load invoices. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchInvoices();
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search, appliedStartDate, appliedEndDate]);

  const handleApplyFilter = () => {
    if (startDate && endDate && startDate > endDate) {
      setFilterError("'From' must be on or before 'To'.");
      return;
    }
    setFilterError("");
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setPage(1);
  };

  const handleResetFilter = () => {
    setFilterError("");
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPage(1);
  };

  // Calculations for summary KPI stats on page
  const pageRevenue = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const avgSale = invoices.length > 0 ? pageRevenue / invoices.length : 0;

  const PAYMENT_BADGES: Record<string, { label: string; icon: any }> = {
    CASH: { label: "CASH", icon: Banknote },
    CARD: { label: "CARD", icon: CreditCard },
    UPI: { label: "UPI", icon: Receipt },
    OTHER: { label: "OTHER", icon: FileText },
  };

  return (
    <PageShell className="max-w-6xl">
        {/* Header */}
        <PageHeader
          title="Sales Invoices"
          description="Search, filter by date, and reprint official customer thermal receipts."
          backHref="/pos/sell"
          backLabel="Back to POS Register"
          actions={
            <span className="text-caption text-ink-48">
              Total invoices: <strong className="text-ink font-semibold tabular">{totalCount}</strong>
            </span>
          }
        />

        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard label="Total invoices" value={totalCount} hint="Transactions in ledger" icon={Receipt} />
          <StatCard label="Page total volume" value={formatCurrency(pageRevenue)} hint={`Sum of ${invoices.length} items`} icon={DollarSign} />
          <StatCard label="Average sale value" value={formatCurrency(avgSale)} hint="Average transaction value" icon={TrendingUp} />
        </div>

        {/* Card Container */}
        <Card className="flex flex-col overflow-hidden">

          {/* Top Toolbar */}
          <div className="p-4 border-b border-divider-soft flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden />
              <Input
                type="text"
                aria-label="Search invoices by invoice number or payment method"
                placeholder="Search invoice # or payment..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2 text-caption">
              <label className="flex items-center gap-2 bg-canvas border border-hairline rounded-full px-4 min-h-11">
                <span className="text-caption text-ink-48">From</span>
                <input
                  type="date"
                  aria-label="From date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="outline-none text-ink text-caption bg-transparent cursor-pointer tabular"
                />
              </label>

              <label className="flex items-center gap-2 bg-canvas border border-hairline rounded-full px-4 min-h-11">
                <span className="text-caption text-ink-48">To</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="outline-none text-ink text-caption bg-transparent cursor-pointer tabular"
                />
              </label>

              <Button onClick={handleApplyFilter}>
                <Filter aria-hidden="true" />
                Filter
              </Button>

              {filterError && <span className="text-caption text-destructive font-semibold" role="alert">{filterError}</span>}

              {(appliedStartDate || appliedEndDate || startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={handleResetFilter}
                  title="Clear Date Filters"
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
              )}
            </div>

            {/* Pagination Quick Indicator */}
            <div className="flex items-center justify-end gap-2 text-caption text-ink-48 shrink-0">
              <span>Page <strong className="text-ink font-semibold tabular">{page}</strong> of <strong className="text-ink font-semibold tabular">{totalPages}</strong></span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  title="Previous Page"
                  aria-label="Previous page"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  title="Next Page"
                  aria-label="Next page"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6">
              <TableSkeleton columns={6} rows={8} />
            </div>
          ) : loadError ? (
            <div className="p-16 text-center text-caption font-semibold text-destructive" role="alert">{loadError}</div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices found"
              description={(search || appliedStartDate || appliedEndDate) ? "Try adjusting your search terms or date filter range." : "No sales transactions have been processed yet."}
              className="py-16"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & time</TableHead>
                    <TableHead>Invoice no.</TableHead>
                    <TableHead>Customer name</TableHead>
                    <TableHead>Payment method</TableHead>
                    <TableHead className="text-right">Total amount</TableHead>
                    <TableHead className="text-right">Receipt actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const hasCustomer = inv.customer_name && inv.customer_name !== "Walk-in Customer";
                    const pm = PAYMENT_BADGES[inv.payment_method] || PAYMENT_BADGES.OTHER;
                    const IconComp = pm.icon;

                    return (
                      <TableRow key={inv._id}>
                        <TableCell className="text-ink-80 whitespace-nowrap tabular">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-ink-48" aria-hidden="true" />
                            {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono font-semibold text-ink whitespace-nowrap">
                          {inv.invoice_no}
                        </TableCell>
                        <TableCell>
                          {hasCustomer ? (
                            <span className="font-semibold text-ink flex items-center gap-1.5">
                              <UserCircle className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
                              {inv.customer_name}
                            </span>
                          ) : (
                            <span className="text-ink-48">
                              Walk-in Customer
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <IconComp aria-hidden="true" />
                            {inv.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-ink tabular whitespace-nowrap">
                          {formatCurrency(inv.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              title="View Receipt"
                              onClick={() => setSelectedSaleId(inv._id)}
                            >
                              <Eye aria-hidden="true" />
                              View
                            </Button>
                            <Button
                              variant="utility"
                              title="Print Receipt"
                              onClick={() => setSelectedSaleId(inv._id)}
                            >
                              <Printer aria-hidden="true" />
                              Print PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Table Footer Pagination Controls */}
              <div className="p-4 border-t border-divider-soft flex flex-col sm:flex-row justify-between items-center gap-3 text-caption text-ink-48">
                <span>Showing <strong className="text-ink font-semibold tabular">{invoices.length}</strong> invoices on page <strong className="text-ink font-semibold tabular">{page}</strong> of <strong className="text-ink font-semibold tabular">{totalPages}</strong> (Total: <span className="tabular">{totalCount}</span>)</span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                  >
                    <ChevronLeft aria-hidden="true" /> Previous
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                  >
                    Next <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

      {selectedSaleId && (
        <InvoiceReceiptModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </PageShell>
  );
}
