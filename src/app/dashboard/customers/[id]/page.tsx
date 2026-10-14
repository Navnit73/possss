"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { Edit, Calendar, CreditCard, ShoppingBag, Receipt } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCurrency } from "@/context/CurrencyContext";
import { PageShell, StatCard, EmptyState } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

export default function CustomerProfilePage() {
  const { id } = useParams();
  const { formatCurrency } = useCurrency();
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
      <div className="flex h-[calc(100dvh-2.75rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner label="" />
          <p className="text-caption text-ink-48">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <PageShell className="max-w-4xl">
        <Alert variant="destructive">
          <p className="font-semibold">Error</p>
          <p>{error || "Customer not found"}</p>
          <Link href="/dashboard/customers" className="text-primary hover:underline mt-2 inline-block">Return to Customers</Link>
        </Alert>
      </PageShell>
    );
  }

  const avgPurchase = customer.total_sales_count > 0 
    ? customer.lifetime_spending / customer.total_sales_count 
    : 0;

  return (
    <PageShell>
      <PageHeader
        title={customer.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-caption">{customer.customer_id}</span>
            {/* Badge renders a <div>, which can't sit inside PageHeader's <p>; same recipe on a span */}
            <span className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-fine-print font-semibold bg-parchment",
              customer.status === 'ACTIVE' ? 'text-success' : 'text-ink-80'
            )}>
              {customer.status}
            </span>
          </span>
        }
        backHref="/dashboard/customers"
        backLabel="Customers"
        actions={
          <Link href={`/dashboard/customers/${customer._id}/edit`} className={buttonClasses({ variant: "outline" })}>
            <Edit aria-hidden="true" />
            Edit Profile
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Lifetime" icon={CreditCard} value={formatCurrency(customer.lifetime_spending || 0)} />
        <StatCard label="Total Orders" icon={ShoppingBag} value={customer.total_sales_count || 0} />
        <StatCard label="Avg Order" icon={Receipt} value={formatCurrency(avgPurchase)} />
        <StatCard
          label="Last Visit"
          icon={Calendar}
          value={customer.last_visit ? format(new Date(customer.last_visit), 'MMM d, yyyy') : 'Never'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Details */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-caption text-ink-48">Phone</dt>
                <dd className="text-body text-ink mt-0.5">{customer.phone || "No phone provided"}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-48">Email</dt>
                <dd className="text-body text-ink mt-0.5 break-words">{customer.email || "No email provided"}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-48">Address</dt>
                <dd className="text-body text-ink mt-0.5">{customer.address || "No address provided"}</dd>
              </div>
              <div>
                <dt className="text-caption text-ink-48">Date of Birth</dt>
                <dd className="text-body text-ink mt-0.5">
                  {customer.date_of_birth ? format(parseISO(customer.date_of_birth), 'MMM d, yyyy') : "No DOB provided"}
                </dd>
              </div>
              {customer.notes && (
                <div>
                  <dt className="text-caption text-ink-48">Notes</dt>
                  <dd className="text-body text-ink mt-0.5 whitespace-pre-line">{customer.notes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
          <CardFooter>
            <p className="text-caption text-ink-48">
              Customer since {format(new Date(customer.created_at), 'MMMM d, yyyy')}
            </p>
          </CardFooter>
        </Card>

        {/* Right Column: History */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
          </CardHeader>
          {(!customer.recent_sales || customer.recent_sales.length === 0) ? (
            <EmptyState icon={ShoppingBag} title="No purchase history found" className="pt-0" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.recent_sales.map((sale: any) => (
                  <TableRow key={sale._id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(sale.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-mono text-ink-80">
                      {sale.invoice_no}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sale.payment_method}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular">
                      {formatCurrency(sale.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
