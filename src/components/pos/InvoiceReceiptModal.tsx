"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, Printer, FileText, ExternalLink, CheckCircle2, RefreshCw } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { lineAmount } from "@/lib/posMath";

interface InvoiceReceiptModalProps {
  saleId: string;
  onClose: () => void;
}

export function InvoiceReceiptModal({ saleId, onClose }: InvoiceReceiptModalProps) {
  const pdfUrl = `/api/pos/invoices/${saleId}/pdf`;
  const jsonUrl = `/api/pos/invoices/${saleId}`;

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;
    let createdBlobUrl: string | null = null;
    const controller = new AbortController();

    // The on-screen receipt only needs the JSON, so it appears immediately...
    axios.get(jsonUrl, { signal: controller.signal })
      .then((res) => {
        if (isMounted) {
          setInvoiceData(res.data);
          setHasError(false);
        }
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error("Failed to load receipt data", err);
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // ...while the slower PDF (used for printing / "Open PDF") is generated in the background.
    axios.get(pdfUrl, { responseType: "blob", signal: controller.signal })
      .then((res) => {
        if (!isMounted) return;
        createdBlobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setPdfBlobUrl(createdBlobUrl);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) console.error("Failed to load receipt PDF", err);
      });

    return () => {
      isMounted = false;
      controller.abort();
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
        setPdfBlobUrl(null); // never print from a revoked URL
      }
    };
  }, [saleId, pdfUrl, jsonUrl, attempt]);

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printWindow = window.open(pdfBlobUrl, "_blank");
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
        return;
      }
    }
    // PDF not ready yet (or popup blocked): print the on-page receipt instead
    window.print();
  };

  // Keyboard: P prints, Esc / N closes and returns to the next sale (Enter is left alone: it confirms the sale, and a double-tap must not dismiss the receipt)
  const printRef = useRef(handlePrint);
  useEffect(() => {
    printRef.current = handlePrint;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "escape" || key === "n") {
        e.preventDefault();
        onClose();
      } else if (key === "p") {
        e.preventDefault();
        printRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sale = invoiceData?.sale;
  const items = invoiceData?.items || [];
  const tenant = invoiceData?.tenant;
  const customer = invoiceData?.customer;

  return (
    <div role="dialog" aria-modal="true" aria-label="Sale receipt" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto font-sans animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:h-auto">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col h-[90vh] max-h-[850px] overflow-hidden print:border-0 print:shadow-none print:w-auto print:max-w-none print:h-auto print:rounded-none">
        
        {/* Modal Header (Hidden on print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 leading-none">
                  {sale ? `Invoice ${sale.invoice_no}` : "Official Sales Receipt"}
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  80mm Thermal
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">Customer Print & Thermal Receipt Preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Receipt <kbd className="ml-1 text-[10px] opacity-80 font-mono">P</kbd>
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              Open PDF
            </a>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close receipt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 bg-slate-100/70 p-4 sm:p-6 overflow-y-auto flex items-center justify-center relative print:p-0 print:bg-white print:overflow-visible">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3" role="status">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
              <span className="text-xs font-bold text-slate-600">Loading receipt...</span>
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 text-center" role="alert">
              <p className="text-sm font-bold text-rose-600">The sale was saved, but the receipt couldn&apos;t be loaded.</p>
              <button
                onClick={() => { setIsLoading(true); setAttempt((n) => n + 1); }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-md p-2 overflow-y-auto print:hidden">
              <HTMLReceiptFallback sale={sale} items={items} tenant={tenant} customer={customer} />
            </div>
          )}

          {/* Printable HTML Element for Direct Window Printing */}
          <div className="hidden print:block w-full max-w-[80mm] mx-auto bg-white text-slate-900 font-mono text-xs">
            <HTMLReceiptFallback sale={sale} items={items} tenant={tenant} customer={customer} />
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-white shrink-0 print:hidden">
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Press <kbd className="font-mono font-bold">P</kbd> to print, <kbd className="font-mono font-bold">Esc</kbd> for the next sale.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Close <kbd className="ml-1 text-[10px] text-slate-400 font-mono">Esc</kbd>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

{/* High-Precision 80mm Thermal Receipt Component with NaN Protection */}
function HTMLReceiptFallback({ sale, items, tenant, customer }: any) {
  const { formatCurrency } = useCurrency();
  if (!sale) return null;

  const subtotal = Number(sale.subtotal ?? (Number(sale.total || 0) - Number(sale.tax || 0) + Number(sale.discount || 0)));
  const discount = Number(sale.discount || 0);
  const tax = Number(sale.tax || 0);
  const total = Number(sale.total || 0);

  return (
    <div className="font-mono text-slate-900 text-xs leading-tight p-4 bg-white select-none">
      <div className="text-center pb-3 border-b border-dashed border-slate-300">
        <h2 className="font-black text-sm uppercase tracking-wider text-slate-900">{tenant?.business_name || "PHARMACY STORE"}</h2>
        {tenant?.address && <p className="text-[10px] text-slate-500 mt-0.5">{tenant.address}</p>}
        {tenant?.phone && <p className="text-[10px] text-slate-500">Tel: {tenant.phone}</p>}
        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mt-1">OFFICIAL CASH RECEIPT</p>
      </div>

      <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-slate-500">Invoice:</span>
          <span className="font-bold">{sale.invoice_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Date:</span>
          <span>{sale.created_at ? new Date(sale.created_at).toLocaleDateString() : ""} {sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
        </div>
        {customer && (
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-bold">{customer.name}</span>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
        <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 pb-1 border-b border-slate-200">
          <span>Item / Batch</span>
          <span>Qty x Price</span>
          <span className="text-right">Total</span>
        </div>
        {items.map((item: any, idx: number) => {
          const itemPrice = Number(item.price || item.unit_price || item.selling_price || 0);
          const itemQty = Number(item.qty || 1);
          const itemDiscount = Number(item.discount || 0);
          const lineTotal = lineAmount(itemPrice, itemQty, itemDiscount); // same rounding the sale was billed with

          return (
            <div key={idx} className="space-y-0.5">
              <div className="flex justify-between font-bold text-slate-900">
                <span className="truncate max-w-[120px]">{item.name}</span>
                <span className="text-slate-500 font-normal">{itemQty} x {formatCurrency(itemPrice)}</span>
                <span className="font-bold text-right">{formatCurrency(lineTotal)}</span>
              </div>
              {item.batch_number && (
                <div className="text-[9px] text-slate-400">
                  Batch #{item.batch_number} {itemDiscount > 0 && `(Disc ${itemDiscount}%)`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="py-2.5 space-y-1 text-[11px]">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-rose-600">
            <span>Discount:</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-slate-600">
          <span>Tax:</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300">
          <span>NET TOTAL:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-dashed border-slate-300 text-center space-y-1">
        <div className="inline-block bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-200">
          PAID VIA {sale.payment_method}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Thank you for shopping with us!</p>
        <p className="text-[9px] text-slate-400">Please keep receipt for any returns.</p>
      </div>
    </div>
  );
}
