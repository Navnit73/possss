"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Search, Edit, Trash2, ChevronRight, UserCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyContext";

export default function CustomersPage() {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/customers", {
        params: { q: search, page, limit: 10 }
      });
      setCustomers(res.data.customers);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error("Failed to fetch customers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm">Manage your customer database and view history.</p>
        </div>
        <Link 
          href="/dashboard/customers/add" 
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex gap-4 bg-surface">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search customers..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // reset to first page on search
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-surface border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Contact Info</th>
                <th className="px-6 py-3 font-semibold">Stats</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer._id} className="bg-white border-b border-border hover:bg-surface/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{customer.name}</div>
                          <div className="text-xs font-mono text-muted-foreground">{customer.customer_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-foreground">{customer.phone || "-"}</div>
                      <div className="text-xs text-muted-foreground">{customer.email || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-foreground font-medium">{formatCurrency(customer.lifetime_spending)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Last Visit: {customer.last_visit ? format(new Date(customer.last_visit), 'MMM d, yyyy') : 'Never'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                        customer.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/customers/${customer._id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-surface">
            <span className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50 hover:bg-white"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
