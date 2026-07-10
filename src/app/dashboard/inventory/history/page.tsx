"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { History, ArrowRight } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function StockHistoryPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const res = await axios.get("/api/inventory/movements");
        setMovements(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load stock history");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMovements();
  }, []);

  const getMovementColor = (type: string, qty: number) => {
    if (type === "PURCHASE" || type === "RETURN" || qty > 0) return "text-green-600 bg-green-50 border-green-200";
    if (type === "SALE" || type === "DAMAGE" || qty < 0) return "text-red-600 bg-red-50 border-red-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          <History className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Stock History</h1>
          <p className="text-muted-foreground mt-1">Immutable ledger of all inventory transactions.</p>
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No stock movements found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-center">Change</th>
                  <th className="px-4 py-3 text-center">Ledger (Before &rarr; After)</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {movements.map((m: any) => (
                  <tr key={m._id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(m.created_at).toLocaleString(undefined, { 
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {m.product?.name || "Unknown Product"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {m.batch?.batch_number || m.batch_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-secondary text-foreground">
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getMovementColor(m.movement_type, m.quantity)}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 text-xs font-medium">
                        <span className="text-muted-foreground">{m.before_qty}</span>
                        <ArrowRight className="w-3 h-3 text-border" />
                        <span className="text-foreground">{m.after_qty}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.user?.name || "System"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={m.notes}>
                      {m.notes || "-"}
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
