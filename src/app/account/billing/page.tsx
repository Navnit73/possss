"use client";

import { useState, useEffect } from "react";
import { Receipt, Download, CreditCard } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

export default function BillingPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);

  const openReceipt = async (paymentId: string) => {
    if (openingReceipt) return;
    // Open the tab during the click: popup blockers reject window.open() after an await
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    setOpeningReceipt(paymentId);
    setError("");
    try {
      const res = await fetch(`/api/account/billing/receipt?payment=${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (tab) tab.location.href = data.url;
      else window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      tab?.close();
      setError(err.message || "Could not open receipt");
    } finally {
      setOpeningReceipt(null);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch("/api/account/billing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageShell className="max-w-[980px]">
        <Card className="p-6">
          <TableSkeleton columns={5} rows={5} />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-[980px]">
      <PageHeader title="Billing History" description="Your subscription payments and receipts." />

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <Card className="overflow-hidden">
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No billing history found." />
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Date</TableHead>
                <TableHead className="px-6">Description</TableHead>
                <TableHead className="px-6">Amount</TableHead>
                <TableHead className="px-6">Status</TableHead>
                <TableHead className="px-6 text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment._id}>
                  <TableCell className="px-6 py-4 font-semibold tabular">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-ink-48" aria-hidden="true" />
                      <span>{payment.plan_name} Plan Subscription</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold tabular">
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: payment.currency || "USD" }).format(payment.amount)}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant={payment.status === "failed" ? "destructive" : "success"} className="capitalize">
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    {payment.has_receipt && payment.payment_id ? (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => openReceipt(payment.payment_id)}
                        disabled={openingReceipt !== null}
                        className="text-caption"
                      >
                        <Download />
                        Receipt
                      </Button>
                    ) : (
                      <span className="text-ink-48">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
