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
import Link from "next/link";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { InvoiceReceiptModal } from "@/components/pos/InvoiceReceiptModal";

export default function PosInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get("/api/pos/invoices", {
          params: {
            page,
            limit,
            q: search,
            startDate: appliedStartDate,
            endDate: appliedEndDate
          }
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
      } catch (err) {
        console.error("Failed to fetch invoices", err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchInvoices();
    }, 200);

    return () => clearTimeout(timer);
  }, [page, search, appliedStartDate, appliedEndDate]);

  const handleApplyFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setPage(1);
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setPage(1);
  };

  // Calculations for summary KPI stats on page
  const pageRevenue = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const avgSale = invoices.length > 0 ? pageRevenue / invoices.length : 0;

  const PAYMENT_BADGES: Record<string, { label: string; style: string; icon: any }> = {
    CASH: { label: "CASH", style: "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold", icon: Banknote },
    CARD: { label: "CARD", style: "bg-slate-100 text-slate-800 border-slate-200 font-bold", icon: CreditCard },
    UPI: { label: "UPI", style: "bg-slate-100 text-slate-800 border-slate-200 font-bold", icon: Receipt },
    OTHER: { label: "OTHER", style: "bg-slate-100 text-slate-800 border-slate-200 font-bold", icon: FileText },
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/pos/sell" className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-0.5" /> Back to POS Register
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                <Receipt className="w-5 h-5" />
              </div>
              Sales Invoices
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">Search, filter by date, and reprint official customer thermal receipts.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-white text-slate-700 px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              Total Invoices: <strong className="text-slate-900">{totalCount}</strong>
            </span>
          </div>
        </div>

        {/* Clean Minimal KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Invoices</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Transactions in ledger</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Page Total Volume</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">${pageRevenue.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sum of {invoices.length} items</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average Sale Value</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">${avgSale.toFixed(2)}</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Average transaction value</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col overflow-hidden">
          
          {/* Top Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <div className="relative w-full lg:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search invoice # or payment..." 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
              />
            </div>
            
            {/* Clean Date Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">From</span>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="outline-none text-slate-800 text-xs font-medium bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-extrabold uppercase text-slate-400">To</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="outline-none text-slate-800 text-xs font-medium bg-transparent cursor-pointer"
                />
              </div>

              <button
                onClick={handleApplyFilter}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>

              {(appliedStartDate || appliedEndDate || startDate || endDate) && (
                <button
                  onClick={handleResetFilter}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Clear Date Filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>

            {/* Pagination Quick Indicator */}
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500 font-medium shrink-0">
              <span>Page <strong className="text-slate-900 font-bold">{page}</strong> of <strong className="text-slate-900 font-bold">{totalPages}</strong></span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6">
              <TableSkeleton columns={6} rows={8} />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1 text-sm">No invoices found</h3>
              <p className="text-slate-500 text-xs max-w-sm">
                {(search || appliedStartDate || appliedEndDate) ? "Try adjusting your search terms or date filter range." : "No sales transactions have been processed yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Date & Time</th>
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Invoice No.</th>
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Customer Name</th>
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Payment Method</th>
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total Amount</th>
                      <th className="px-5 py-3 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider text-right">Receipt Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {invoices.map((inv) => {
                      const hasCustomer = inv.customer_name && inv.customer_name !== "Walk-in Customer";
                      const pm = PAYMENT_BADGES[inv.payment_method] || PAYMENT_BADGES.OTHER;
                      const IconComp = pm.icon;

                      return (
                        <tr key={inv._id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-5 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900 font-mono">
                            <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                              {inv.invoice_no}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {hasCustomer ? (
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                <UserCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                {inv.customer_name}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium italic">
                                Walk-in Customer
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${pm.style}`}>
                              <IconComp className="w-3 h-3 text-slate-500" />
                              {inv.payment_method}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">
                            ${inv.total?.toFixed(2)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                                title="View Receipt"
                                onClick={() => setSelectedSaleId(inv._id)}
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                View
                              </button>
                              <button 
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Print Receipt"
                                onClick={() => setSelectedSaleId(inv._id)}
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Print PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Pagination Controls */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
                <span>Showing <strong className="text-slate-900 font-bold">{invoices.length}</strong> invoices on page <strong className="text-slate-900 font-bold">{page}</strong> of <strong className="text-slate-900 font-bold">{totalPages}</strong> (Total: {totalCount})</span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedSaleId && (
        <InvoiceReceiptModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}
