"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, Package, Search, Eye, Edit } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/products");
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (err: any) {
        console.error("Failed to fetch products", err);
        setError(err.response?.data?.error || "Failed to load products");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const term = search.trim().toLowerCase();
  const filteredProducts = products.filter(p => 
    !term ||
    (p.name || "").toLowerCase().includes(term) || 
    (p.generic_name && String(p.generic_name).toLowerCase().includes(term)) ||
    (p.barcode && String(p.barcode).toLowerCase().includes(term)) ||
    (p.sku && String(p.sku).toLowerCase().includes(term))
  );

  return (
    <PageShell>
      <PageHeader 
        title="Products"
        description="Manage your pharmacy's medicine master catalog."
        actions={
          <Link href="/dashboard/products/add" className={buttonClasses()}>
            <Plus aria-hidden="true" />
            Add Product
          </Link>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="overflow-hidden flex flex-col">
        <div className="p-4 border-b border-hairline">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
            <Input 
              type="text" 
              aria-label="Search products"
              placeholder="Search by name, generic name, SKU, or barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description={search ? "Try adjusting your search terms." : "Your product master catalog is empty. Add a product to get started."}
            action={
              !search ? (
                <Link href="/dashboard/products/add" className={buttonClasses()}>
                  Add Your First Product
                </Link>
              ) : undefined
            }
            className="py-16"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rack</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Stock Alert</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <p className="font-semibold text-ink">{p.name}</p>
                    {p.generic_name && <p className="text-fine-print text-ink-48">{p.generic_name}</p>}
                  </TableCell>
                  <TableCell>
                    {p.brand || <span className="text-ink-48">-</span>}
                  </TableCell>
                  <TableCell>
                    {p.category?.name || <span className="text-ink-48 italic">Uncategorized</span>}
                  </TableCell>
                  <TableCell>
                    {p.rack_number || <span className="text-ink-48">-</span>}
                  </TableCell>
                  <TableCell>
                    <span className={cn("font-semibold tabular", p.total_stock === 0 || !p.total_stock ? "text-destructive" : p.total_stock <= p.minimum_stock ? "text-warning" : "text-ink")}>
                      {p.total_stock || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.minimum_stock > 0 ? (
                      <Badge variant="warning" className="tabular">Min: {p.minimum_stock}</Badge>
                    ) : (
                      <span className="text-ink-48">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.status === "ACTIVE" ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link 
                        href={`/dashboard/products/${p._id}`}
                        className={buttonClasses({ variant: "ghost", size: "icon", className: "text-ink" })}
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye aria-hidden="true" />
                      </Link>
                      <Link 
                        href={`/dashboard/products/${p._id}/edit`}
                        className={buttonClasses({ variant: "ghost", size: "icon" })}
                        title="Edit Product"
                        aria-label="Edit Product"
                      >
                        <Edit aria-hidden="true" />
                      </Link>
                    </div>
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
