"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

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
    <PageShell>
      <PageHeader 
        title="Low Stock Alerts"
        description="Products whose sellable (non-expired) stock is at or below their minimum stock threshold."
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={6} rows={5} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="All Stock Levels Optimal"
            description="There are no products currently running low on stock."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Min stock</TableHead>
                <TableHead className="text-center">Current stock</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item._id}>
                  <TableCell className="font-semibold text-ink">
                    {item.name} {item.strength ? `(${item.strength})` : ""}
                  </TableCell>
                  <TableCell className="font-mono text-fine-print text-ink-48">
                    {item.sku || "-"}
                  </TableCell>
                  <TableCell className="text-center tabular text-ink-48">
                    {item.minimum_stock || 0}
                  </TableCell>
                  <TableCell className="text-center tabular font-semibold text-destructive">
                    {item.total_stock}
                  </TableCell>
                  <TableCell className="text-ink-48">
                    {item.rack_number || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link 
                      href={`/dashboard/inventory/add-stock?product_id=${item._id}`}
                      className="text-link inline-flex items-center gap-1 text-caption"
                    >
                      Order More
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
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
