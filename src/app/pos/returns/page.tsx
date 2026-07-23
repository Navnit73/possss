"use client";

import Link from "next/link";
import { Undo2, ChevronLeft, Clock, Sparkles, ShieldAlert } from "lucide-react";

export default function PosReturnsPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-surface text-foreground p-6 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full text-center space-y-6">
        
        {/* Back Link */}
        <div className="flex justify-start">
          <Link 
            href="/pos/sell" 
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Register
          </Link>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white border border-border rounded-2xl shadow-xl p-10 flex flex-col items-center relative overflow-hidden">
          
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shadow-sm relative">
            <Undo2 className="w-10 h-10" />
            <div className="absolute -top-1 -right-1 p-1 bg-amber-500 text-white rounded-full shadow">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Feature Under Development
          </span>

          {/* Title */}
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
            POS Sales Returns
          </h1>

          <p className="text-muted-foreground text-sm max-w-md leading-relaxed mb-6">
            The Sales Returns & Refunds module is <strong>COMING IN FUTURE</strong> updates. You will be able to process customer medicine returns, restock inventory batches, and issue store credit or cash refunds directly from the POS interface.
          </p>

          {/* Feature Highlights */}
          <div className="w-full bg-surface border border-border rounded-xl p-4 text-left space-y-2 text-xs text-muted-foreground mb-6">
            <div className="font-semibold text-foreground text-sm mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Planned Capabilities:
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>Full & partial receipt item returns with barcode scanning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>Automatic inventory batch restocking and condition audits</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>Refund processing via Cash, Card reversal, or Store Credit</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/pos/sell"
              className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              Go to POS Register
            </Link>
            <Link
              href="/pos/invoices"
              className="px-6 py-2.5 bg-secondary text-foreground font-semibold text-sm rounded-lg hover:bg-secondary/80 transition-colors border border-border"
            >
              View Past Invoices
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
