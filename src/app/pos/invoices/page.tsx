"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { FileText, Eye, Printer, Search, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PosInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await axios.get("/api/pos/invoices");
        setInvoices(res.data);
      } catch (err) {
        console.error("Failed to fetch invoices", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 font-sans p-6">
      <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link href="/pos/sell" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-2">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Register
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" /> 
            Sales Invoices
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">View and reprint past transactions.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm flex flex-col">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by invoice number..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1 text-sm">No invoices found</h3>
            <p className="text-slate-500 text-xs max-w-sm">
              {search ? "Try adjusting your search." : "No sales have been processed yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice No.</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredInvoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 font-mono text-xs">
                      {inv.invoice_no}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                        {inv.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      ${inv.total?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                          title="View Receipt"
                          onClick={() => alert("Receipt View (Stub)")}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                          title="Print"
                          onClick={() => alert("Print Receipt (Stub)")}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
