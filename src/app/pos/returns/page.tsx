"use client";

import Link from "next/link";
import { Undo2, ChevronLeft, Clock, Sparkles, ShieldAlert } from "lucide-react";

export default function PosReturnsPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 p-6 flex flex-col items-center justify-center font-sans">
      <div className="max-w-xl w-full text-center space-y-6">
        
        {/* Back Link */}
        <div className="flex justify-start">
          <Link 
            href="/pos/sell" 
            className="inline-flex items-center text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-0.5" /> Back to POS Register
          </Link>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-10 flex flex-col items-center relative overflow-hidden">
          
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Icon Badge */}
          <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-6 shadow-2xs relative">
            <Undo2 className="w-10 h-10" />
            <div className="absolute -top-1 -right-1 p-1 bg-amber-500 text-white rounded-full shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Feature Under Development
          </span>

          {/* Title */}
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            POS Sales Returns
          </h1>

          <p className="text-slate-500 text-xs max-w-md leading-relaxed mb-6 font-medium">
            The Sales Returns & Refunds module is coming in future updates. You will be able to process customer medicine returns, restock inventory batches, and issue store credit or cash refunds directly.
          </p>

          {/* Feature Highlights */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-600 mb-6">
            <div className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-600" />
              Planned Capabilities:
            </div>
            <div className="flex items-center gap-2 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Full & partial receipt item returns with barcode scanning</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Automatic inventory batch restocking and condition audits</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Refund processing via Cash, Card reversal, or Store Credit</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href="/pos/sell"
              className="px-6 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition-colors shadow-2xs"
            >
              Go to POS Register
            </Link>
            <Link
              href="/pos/invoices"
              className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
            >
              View Past Invoices
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
