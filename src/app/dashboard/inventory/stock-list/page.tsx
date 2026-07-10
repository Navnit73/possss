"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, ChevronDown, ChevronRight, Package, AlertCircle } from "lucide-react";

export default function StockListPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await axios.get("/api/inventory/batches");
        setBatches(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load stock data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBatches();
  }, []);

  // Group batches by product
  const groupedStock = batches.reduce((acc: any, batch: any) => {
    const pId = batch.product_id;
    if (!acc[pId]) {
      acc[pId] = {
        product: batch.product,
        totalQty: 0,
        batches: []
      };
    }
    acc[pId].totalQty += batch.qty_available;
    acc[pId].batches.push(batch);
    return acc;
  }, {});

  const toggleExpand = (pId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(pId)) {
      newSet.delete(pId);
    } else {
      newSet.add(pId);
    }
    setExpandedProducts(newSet);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Stock List</h1>
          <p className="text-muted-foreground mt-1">Manage inventory levels across all product batches.</p>
        </div>
        <Link 
          href="/dashboard/inventory/add-stock"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Receive Stock
        </Link>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading stock data...</div>
        ) : Object.keys(groupedStock).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
            <Package className="w-12 h-12 mb-4 text-muted-foreground/50" />
            <p>No inventory found.</p>
            <Link href="/dashboard/inventory/add-stock" className="text-primary hover:underline mt-2">Add your first batch</Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 font-medium text-sm text-muted-foreground">
              <div className="col-span-1"></div>
              <div className="col-span-4">Product Name</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Total Stock</div>
              <div className="col-span-2 text-center">Status</div>
            </div>

            {/* Grouped Rows */}
            {Object.values(groupedStock).map((group: any) => {
              const pId = group.product?._id;
              const isExpanded = expandedProducts.has(pId);
              const minStock = group.product?.minimum_stock || 0;
              const isLowStock = group.totalQty <= minStock;

              return (
                <div key={pId} className="divide-y divide-border/50">
                  {/* Product Parent Row */}
                  <div 
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(pId)}
                  >
                    <div className="col-span-1 flex justify-center text-muted-foreground">
                      {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                    <div className="col-span-4 font-medium text-foreground flex items-center gap-2">
                      {group.product?.name}
                      {group.product?.strength && <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-secondary rounded">{group.product.strength}</span>}
                    </div>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {group.product?.category?.name || "Uncategorized"}
                    </div>
                    <div className="col-span-2 text-right font-semibold text-foreground flex items-center justify-end gap-2">
                      {group.totalQty}
                      {isLowStock && (
                        <span title={`Low Stock (Min: ${minStock})`}>
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isLowStock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>
                  </div>

                  {/* Batches Child Rows */}
                  {isExpanded && (
                    <div className="bg-muted/10 pb-2">
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/30">
                        <div className="col-span-1"></div>
                        <div className="col-span-2">Batch #</div>
                        <div className="col-span-2">Supplier</div>
                        <div className="col-span-2">Expiry</div>
                        <div className="col-span-2">Rack</div>
                        <div className="col-span-1 text-right">Cost</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Qty</div>
                      </div>
                      {group.batches.map((batch: any) => (
                        <div key={batch._id} className="grid grid-cols-12 gap-4 px-4 py-2 text-sm text-foreground hover:bg-muted/30">
                          <div className="col-span-1"></div>
                          <div className="col-span-2 font-mono text-xs">{batch.batch_number}</div>
                          <div className="col-span-2 text-muted-foreground truncate">{batch.supplier || "-"}</div>
                          <div className="col-span-2">{batch.expiry_date || "-"}</div>
                          <div className="col-span-2">{batch.rack_location || group.product?.rack_number || "-"}</div>
                          <div className="col-span-1 text-right">${batch.cost_price.toFixed(2)}</div>
                          <div className="col-span-1 text-right">${batch.selling_price.toFixed(2)}</div>
                          <div className="col-span-1 text-right font-medium">{batch.qty_available}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
