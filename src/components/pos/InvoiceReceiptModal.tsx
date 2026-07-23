"use client";

import { useState } from "react";
import { X, Printer, Download, FileText, ExternalLink } from "lucide-react";

interface InvoiceReceiptModalProps {
  saleId: string;
  onClose: () => void;
}

export function InvoiceReceiptModal({ saleId, onClose }: InvoiceReceiptModalProps) {
  const pdfUrl = `/api/pos/invoices/${saleId}/pdf`;

  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, "_blank");
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border w-full max-w-2xl rounded-xl shadow-2xl flex flex-col h-[85vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Official PDF Receipt</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print PDF Receipt
            </button>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors border border-border"
            >
              <ExternalLink className="w-4 h-4" />
              Open PDF
            </a>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content - Embedded Backend-Generated PDF */}
        <div className="flex-1 bg-slate-900 p-2 relative">
          <iframe
            src={pdfUrl}
            className="w-full h-full rounded border-0 bg-white"
            title="Invoice Receipt PDF"
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex justify-between items-center bg-secondary/30">
          <p className="text-xs text-muted-foreground">
            Backend-generated 80mm thermal PDF receipt ready for printing.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
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
