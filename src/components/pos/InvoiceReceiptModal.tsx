"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, Printer, FileText, ExternalLink, CheckCircle2, RefreshCw } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { lineAmount } from "@/lib/posMath";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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
    <div role="dialog" aria-modal="true" aria-label="Sale receipt" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-canvas print:static print:h-auto">
      <div className="bg-canvas w-full max-w-3xl rounded-lg flex flex-col h-[90vh] max-h-[850px] overflow-hidden print:w-auto print:max-w-none print:h-auto print:rounded-none">

        {/* Modal Header (Hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-divider-soft shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="size-5 text-ink-48 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-tagline text-ink">
                  {sale ? `Invoice ${sale.invoice_no}` : "Official Sales Receipt"}
                </h2>
                <Badge variant="success">
                  <CheckCircle2 aria-hidden="true" />
                  80mm Thermal
                </Badge>
              </div>
              <p className="text-caption text-ink-48 mt-1">Customer print & thermal receipt preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handlePrint}>
              <Printer aria-hidden="true" />
              Print Receipt <kbd className="text-fine-print opacity-80">P</kbd>
            </Button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "outline" })}
            >
              <ExternalLink aria-hidden="true" />
              Open PDF
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close receipt"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 bg-parchment p-4 sm:p-6 overflow-y-auto flex items-center justify-center relative print:p-0 print:bg-canvas print:overflow-visible">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3" role="status">
              <RefreshCw className="size-8 text-ink-48 animate-spin" aria-hidden="true" />
              <span className="text-caption text-ink-48">Loading receipt...</span>
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center p-12 gap-4 text-center" role="alert">
              <p className="text-caption font-semibold text-destructive">The sale was saved, but the receipt couldn&apos;t be loaded.</p>
              <Button onClick={() => { setIsLoading(true); setAttempt((n) => n + 1); }}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="w-full max-w-sm bg-canvas rounded-lg border border-hairline p-2 overflow-y-auto print:hidden">
              <HTMLReceiptFallback sale={sale} items={items} tenant={tenant} customer={customer} />
            </div>
          )}

          {/* Printable HTML Element for Direct Window Printing */}
          <div className="hidden print:block w-full max-w-[80mm] mx-auto bg-canvas text-ink text-fine-print">
            <HTMLReceiptFallback sale={sale} items={items} tenant={tenant} customer={customer} />
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="px-6 py-4 border-t border-divider-soft flex flex-wrap gap-3 justify-between items-center shrink-0 print:hidden">
          <p className="text-caption text-ink-48">
            Press <kbd className="font-semibold text-ink">P</kbd> to print, <kbd className="font-semibold text-ink">Esc</kbd> for the next sale.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close <kbd className="text-fine-print opacity-60">Esc</kbd>
            </Button>
            <Button onClick={handlePrint}>
              <Printer aria-hidden="true" />
              Print Receipt
            </Button>
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
    <div className="text-ink text-fine-print tabular p-4 bg-canvas select-none">
      <div className="text-center pb-3 border-b border-dashed border-hairline">
        <h2 className="text-caption font-semibold text-ink">{tenant?.business_name || "PHARMACY STORE"}</h2>
        {tenant?.address && <p className="text-fine-print text-ink-48 mt-1">{tenant.address}</p>}
        {tenant?.phone && <p className="text-fine-print text-ink-48">Tel: {tenant.phone}</p>}
        <p className="text-fine-print font-semibold text-ink-80 mt-1.5">Official cash receipt</p>
      </div>

      <div className="py-2.5 border-b border-dashed border-hairline space-y-1">
        <div className="flex justify-between">
          <span className="text-ink-48">Invoice:</span>
          <span className="font-mono font-semibold">{sale.invoice_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-48">Date:</span>
          <span>{sale.created_at ? new Date(sale.created_at).toLocaleDateString() : ""} {sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
        </div>
        {customer && (
          <div className="flex justify-between">
            <span className="text-ink-48">Customer:</span>
            <span className="font-semibold">{customer.name}</span>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="py-2.5 border-b border-dashed border-hairline space-y-2">
        <div className="flex justify-between font-semibold text-ink-48 pb-1 border-b border-divider-soft">
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
              <div className="flex justify-between gap-2 font-semibold text-ink">
                <span className="truncate max-w-[120px]">{item.name}</span>
                <span className="text-ink-48 font-normal">{itemQty} x {formatCurrency(itemPrice)}</span>
                <span className="text-right">{formatCurrency(lineTotal)}</span>
              </div>
              {item.batch_number && (
                <div className="text-micro-legal text-ink-48">
                  Batch #<span className="font-mono">{item.batch_number}</span> {itemDiscount > 0 && `(Disc ${itemDiscount}%)`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="py-2.5 space-y-1">
        <div className="flex justify-between text-ink-80">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-ink-80">
            <span>Discount:</span>
            <span>-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-ink-80">
          <span>Tax:</span>
          <span>{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-between text-caption font-semibold text-ink pt-1.5 border-t border-hairline">
          <span>Net total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-dashed border-hairline text-center space-y-1">
        <div className="inline-block text-fine-print font-semibold text-ink-80 px-2.5 py-1 rounded-full border border-hairline">
          Paid via {sale.payment_method}
        </div>
        <p className="text-fine-print text-ink-48 mt-2">Thank you for shopping with us!</p>
        <p className="text-micro-legal text-ink-48">Please keep receipt for any returns.</p>
      </div>
    </div>
  );
}
