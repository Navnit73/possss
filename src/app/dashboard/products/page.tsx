"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, Package, Search, Eye, Edit } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axios.get("/api/products");
        setProducts(res.data);
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.generic_name && p.generic_name.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode && p.barcode.includes(search)) ||
    (p.sku && p.sku.includes(search))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your pharmacy's medicine master catalog.</p>
        </div>
        <Link
          href="/dashboard/products/add"
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col ">
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name, generic name, SKU, or barcode..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={8} rows={6} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {search ? "Try adjusting your search terms." : "Your product master catalog is empty. Add a product to get started."}
            </p>
            {!search && (
              <Link
                href="/dashboard/products/add"
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Add Your First Product
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Medicine Name</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Brand</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Category</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Rack</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Current Stock</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Stock Alert</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="p-4 text-sm font-semibold text-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="p-4">
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.generic_name && <p className="text-xs text-muted-foreground">{p.generic_name}</p>}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {p.brand || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {p.category?.name || <span className="text-muted-foreground italic">Uncategorized</span>}
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      {p.rack_number || <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`font-medium ${p.total_stock === 0 || !p.total_stock ? "text-red-500" : p.total_stock <= p.minimum_stock ? "text-amber-600" : "text-foreground"}`}>
                        {p.total_stock || 0}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      {p.minimum_stock > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Min: {p.minimum_stock}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {p.status === "ACTIVE" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link 
                        href={`/dashboard/products/${p._id}`}
                        className="inline-flex items-center justify-center p-2 rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link 
                        href={`/dashboard/products/${p._id}/edit`}
                        className="inline-flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Edit Product"
                      >
                        <Edit className="w-4 h-4" />
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
