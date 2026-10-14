"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, History, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title={supplier ? `${supplier.name} - Purchase History` : "All Purchase History"}
        description="View historical stock receipts and batches."
        backHref={supplierId ? `/dashboard/suppliers/${supplierId}` : "/dashboard/suppliers"}
      />

      {error && <div role="alert" className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading history...</div>
        ) : batches.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <History className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No purchase history found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              There are no received batches recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Date</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Batch Number</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Product</th>
                  {!supplierId && <th className="p-4 text-sm font-semibold text-foreground">Supplier</th>}
                  <th className="p-4 text-sm font-semibold text-foreground">Quantity Received</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Cost Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => (
                  <tr key={b._id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 text-sm text-foreground">
                      {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="p-4 text-sm text-foreground font-medium">
                      {b.batch_number}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {b.product?.name || "Unknown Product"}
                        </span>
                      </div>
                    </td>
                    {!supplierId && (
                      <td className="p-4 text-sm text-foreground">
                        {b.supplier || "-"}
                      </td>
                    )}
                    <td className="p-4 text-sm text-foreground">
                      {/* qty_available shrinks as stock sells; qty_received is the original receipt (older batches lack it) */}
                      {b.qty_received ?? b.qty_available}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {formatCurrency(Number(b.cost_price || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchaseHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}>
      <PurchaseHistoryContent />
    </Suspense>
  );
}
