"use client";

import { useState, useEffect } from "react";
import { Receipt, Download, CreditCard } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function BillingPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/account/billing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayments(data);
    } catch (err: any) {
      setError(err.message || "Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8"><TableSkeleton columns={5} rows={5} /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing History</h1>
        <p className="text-muted-foreground">View and download your past subscription invoices.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground">Date</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Description</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-3 font-medium text-muted-foreground text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>No billing history found.</p>
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span>{payment.plan_name} Plan Subscription</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    ${payment.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500">
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 text-sm font-medium">
                      <Download className="w-4 h-4" />
                      PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
