"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Package } from "lucide-react";

export default function LowStockAlertsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await axios.get("/api/inventory/low-stock");
        setItems(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load alerts");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-red-100 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Low Stock Alerts</h1>
          <p className="text-muted-foreground mt-1">Products currently at or below their minimum stock threshold.</p>
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Checking inventory levels...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">All Stock Levels Optimal</h3>
            <p className="text-muted-foreground">There are no products currently running low on stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4 text-center">Min Stock</th>
                  <th className="px-6 py-4 text-center">Current Stock</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item: any) => (
                  <tr key={item._id} className="hover:bg-red-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {item.name} {item.strength ? `(${item.strength})` : ""}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.sku || "-"}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-muted-foreground">
                      {item.minimum_stock || 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border text-red-700 bg-red-100 border-red-200">
                        {item.total_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.rack_number || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/inventory/add-stock?product_id=${item._id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Order More
                        <ArrowRight className="w-3 h-3" />
                      </Link>
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
