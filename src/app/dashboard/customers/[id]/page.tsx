"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, UserCircle, Phone, Mail, MapPin, Calendar, CreditCard, ShoppingBag, Receipt } from "lucide-react";
import { format } from "date-fns";

export default function CustomerProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await axios.get(`/api/customers/${id}`);
        setCustomer(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load customer");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCustomer();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100 flex flex-col gap-2">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error || "Customer not found"}</p>
          <Link href="/dashboard/customers" className="text-sm underline mt-2">Return to Customers</Link>
        </div>
      </div>
    );
  }

  const avgPurchase = customer.total_sales_count > 0 
    ? customer.lifetime_spending / customer.total_sales_count 
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {customer.name}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider align-middle ${
                customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {customer.status}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm font-mono">{customer.customer_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/customers/${customer._id}/edit`} className="bg-white border border-border px-4 py-2 rounded-md font-medium text-sm hover:bg-surface text-foreground/80">
            Edit Profile
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-border shadow-sm p-5">
            <h3 className="font-semibold text-foreground mb-4">Contact Information</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 text-muted-foreground">
                <Phone className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-foreground">{customer.phone || "No phone provided"}</span>
              </div>
              <div className="flex items-start gap-3 text-muted-foreground">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-foreground">{customer.email || "No email provided"}</span>
              </div>
              <div className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-foreground leading-relaxed">{customer.address || "No address provided"}</span>
              </div>
              <div className="flex items-start gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="text-foreground">
                  {customer.date_of_birth ? format(new Date(customer.date_of_birth), 'MMM d, yyyy') : "No DOB provided"}
                </span>
              </div>
            </div>
            
            {customer.notes && (
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-semibold text-foreground mb-2 text-sm">Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed bg-surface p-3 rounded">{customer.notes}</p>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground">
              Customer since {format(new Date(customer.created_at), 'MMMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Right Column: Stats & History */}
        <div className="md:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Lifetime
              </div>
              <div className="text-2xl font-bold text-slate-900">${customer.lifetime_spending?.toFixed(2) || "0.00"}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" /> Total Orders
              </div>
              <div className="text-2xl font-bold text-slate-900">{customer.total_sales_count || 0}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" /> Avg Order
              </div>
              <div className="text-2xl font-bold text-slate-900">${avgPurchase.toFixed(2)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-border shadow-sm">
              <div className="text-muted-foreground text-xs font-semibold mb-1 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Last Visit
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {customer.last_visit ? format(new Date(customer.last_visit), 'MMM d, yyyy') : 'Never'}
              </div>
            </div>
          </div>

          {/* Recent Purchases */}
          <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
              <h3 className="font-semibold text-foreground">Recent Purchases</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Date</th>
                    <th className="px-6 py-3 font-semibold">Invoice No</th>
                    <th className="px-6 py-3 font-semibold">Method</th>
                    <th className="px-6 py-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(!customer.recent_sales || customer.recent_sales.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No purchase history found.
                      </td>
                    </tr>
                  ) : (
                    customer.recent_sales.map((sale: any) => (
                      <tr key={sale._id} className="bg-white border-b border-border last:border-0 hover:bg-surface transition-colors">
                        <td className="px-6 py-4 text-foreground whitespace-nowrap">
                          {format(new Date(sale.created_at), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                          {sale.invoice_no}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-900">
                          ${sale.total.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
