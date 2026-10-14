"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Search, ChevronRight, UserCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useCurrency } from "@/context/CurrencyContext";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

export default function CustomersPage() {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadError, setLoadError] = useState("");

  // Debounced, and older requests are aborted so a slow response for "jo" can't replace the results for "john"
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setLoadError("");
        const res = await axios.get("/api/customers", {
          params: { q: search, page, limit: 10 },
          signal: controller.signal,
        });
        setCustomers(res.data.customers ?? []);
        setTotalPages(Math.max(1, res.data.totalPages || 1));
      } catch (error: any) {
        if (axios.isCancel(error)) return;
        console.error("Failed to fetch customers", error);
        setCustomers([]);
        setLoadError(error.response?.data?.error || "Failed to load customers.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, search]);

  return (
    <PageShell>
      <PageHeader
        title="Customers"
        description="Manage your customer database and view history."
        actions={
          <Link href="/dashboard/customers/add" className={buttonClasses()}>
            <Plus aria-hidden="true" />
            Add Customer
          </Link>
        }
      />


      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden />
        <Input
          type="text"
          aria-label="Search customers by name, phone, email or ID"
          placeholder="Search customers..."
          className="pl-10"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // reset to first page on search
          }}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={5} />
          </div>
        ) : loadError ? (
          <EmptyState icon={UserCircle} title="Couldn't load customers" description={loadError} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title="No customers found"
            description={search ? "Try adjusting your search terms." : "Your customer list is empty. Add a customer to get started."}
            action={
              !search && (
                <Link href="/dashboard/customers/add" className={buttonClasses()}>
                  Add Your First Customer
                </Link>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-parchment flex items-center justify-center text-body font-semibold text-ink-80 shrink-0" aria-hidden="true">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{customer.name}</div>
                        <div className="text-fine-print font-mono text-ink-48 mt-0.5">{customer.customer_id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-ink">{customer.phone || "-"}</div>
                    <div className="text-fine-print text-ink-48 mt-0.5">{customer.email || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-ink font-semibold tabular">{formatCurrency(customer.lifetime_spending)}</div>
                    <div className="text-fine-print text-ink-48 mt-0.5">
                      Last Visit: {customer.last_visit ? format(new Date(customer.last_visit), 'MMM d, yyyy') : 'Never'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'ACTIVE' ? 'success' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/customers/${customer._id}`}
                      aria-label={`View ${customer.name}`}
                      className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink-48" })}
                    >
                      <ChevronRight aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-hairline flex items-center justify-between gap-4">
            <span className="text-caption text-ink-48">
              Showing page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
