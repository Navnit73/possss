"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { History, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { useCurrency } from "@/context/CurrencyContext";

function PurchaseHistoryContent() {
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplierId");

  const [batches, setBatches] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setIsLoading(true);
      setError("");
      try {
        if (supplierId) {
          // Fetch specific supplier details
          const [supRes, histRes] = await Promise.all([
            axios.get(`/api/suppliers/${supplierId}`),
            axios.get(`/api/suppliers/${supplierId}/history`)
          ]);
          if (cancelled) return;
          setSupplier(supRes.data);
          setBatches(Array.isArray(histRes.data) ? histRes.data : []);
        } else {
          // Fetch all batches and all suppliers for a general view
          // Here we just fetch all batches and we could map them, but for this page's scope,
          // if no supplierId is provided, we can fetch all batches and display them.
          const res = await axios.get("/api/inventory/batches");
          if (cancelled) return;
          setSupplier(null);
          setBatches(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err: any) {
        console.error("Failed to fetch purchase history", err);
        if (!cancelled) setError(err.response?.data?.error || "Failed to load purchase history");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [supplierId]);

  return (
    <PageShell>
      <PageHeader 
        title={supplier ? `${supplier.name} - Purchase History` : "All Purchase History"}
        description="View historical stock receipts and batches."
        backHref={supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard/suppliers"}
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={supplierId ? 5 : 6} rows={5} />
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            icon={History}
            title="No purchase history found"
            description="There are no received batches recorded yet."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Batch Number</TableHead>
                <TableHead>Product</TableHead>
                {!supplierId && <TableHead>Supplier</TableHead>}
                <TableHead className="text-right">Quantity Received</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b._id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="font-mono text-ink-80">
                    {b.batch_number}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
                      <span className="font-semibold text-ink">
                        {b.product?.name || "Unknown Product"}
                      </span>
                    </div>
                  </TableCell>
                  {!supplierId && (
                    <TableCell>
                      {b.supplier || "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular">
                    {/* qty_available shrinks as stock sells; qty_received is the original receipt (older batches lack it) */}
                    {b.qty_received ?? b.qty_available}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatCurrency(Number(b.cost_price || 0))}
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

export default function PurchaseHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-2.75rem)] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <PurchaseHistoryContent />
    </Suspense>
  );
}
