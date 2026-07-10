"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { Plus, ChevronDown, ChevronRight, Package, AlertCircle } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8 font-sans">
      <PageHeader 
        title="Stock List"
        description="Manage inventory levels across all product batches."
        actions={
          <Link 
            href="/dashboard/inventory/add-stock"
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-semibold shadow-sm hover:shadow-lime-200 hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            Receive Stock
          </Link>
        }
      />

      {error && <div className="p-4 text-sm text-rose-600 bg-rose-50 rounded-xl border border-rose-200 font-medium">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={6} />
          </div>
        ) : Object.keys(groupedStock).length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No inventory found.</p>
            <Link href="/dashboard/inventory/add-stock" className="text-lime-600 hover:text-lime-700 font-semibold text-sm mt-3 bg-lime-50 hover:bg-lime-100 px-4 py-2 rounded-full transition-colors">Add your first batch</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-5 bg-slate-50/80 font-bold text-xs tracking-wider text-slate-500 uppercase border-b border-slate-100">
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
                <div key={pId} className="flex flex-col border-b border-slate-100 last:border-0 group/parent">
                  {/* Product Parent Row */}
                  <div 
                    className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${isExpanded ? 'bg-lime-50 hover:bg-lime-100/60' : 'hover:bg-slate-50'}`}
                    onClick={() => toggleExpand(pId)}
                  >
                    <div className="col-span-1 flex justify-center text-slate-400">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-lime-200 text-lime-600 shadow-sm' : 'hover:bg-slate-200 text-slate-500'}`}>
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                    <div className="col-span-4 font-bold text-slate-900 flex items-center gap-2">
                      {group.product?.name}
                      {group.product?.strength && (
                        <span className="text-xs font-semibold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full border border-slate-200">
                          {group.product.strength}
                        </span>
                      )}
                    </div>
                    <div className="col-span-3 text-sm font-medium text-slate-500">
                      {group.product?.category?.name || "Uncategorized"}
                    </div>
                    <div className="col-span-2 text-right font-black text-slate-900 flex items-center justify-end gap-2">
                      {group.totalQty}
                      {isLowStock && (
                        <span title={`Low Stock (Min: ${minStock})`}>
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                        isLowStock 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </div>
                  </div>

                  {/* Batches Child Rows (Tree UI) */}
                  {isExpanded && (
                    <div className="bg-slate-50/50 pb-4 shadow-inner">
                      {/* Child Table Header */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider relative">
                        {/* Connecting vertical line for header */}
                        <div className="col-span-1 relative">
                           <div className="absolute left-1/2 top-0 w-[2px] bg-lime-600 -translate-x-1/2 h-full"></div>
                        </div>
                        <div className="col-span-2">Batch #</div>
                        <div className="col-span-2">Supplier</div>
                        <div className="col-span-2">Expiry</div>
                        <div className="col-span-2">Rack</div>
                        <div className="col-span-1 text-right">Cost</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Qty</div>
                      </div>

                      {/* Child Rows */}
                      {group.batches.map((batch: any, index: number) => {
                        const isLast = index === group.batches.length - 1;
                        return (
                          <div key={batch._id} className="grid grid-cols-12 gap-4 px-4 py-2.5 text-sm text-slate-700 hover:bg-lime-50 cursor-pointer transition-colors group/row">
                            <div className="col-span-1 relative flex items-center min-h-[36px]">
                              {/* Vertical tree line */}
                              <div className={`absolute left-1/2 top-0 w-[2px] bg-lime-600 -translate-x-1/2 ${isLast ? 'h-[50%]' : 'h-full'}`}></div>
                              
                              {/* Horizontal branch line */}
                              <div className="absolute left-1/2 top-1/2 w-[calc(50%+16px)] h-[2px] bg-lime-600"></div>
                              
                              {/* Tree node dot */}
                              <div className="absolute right-[-20px] top-1/2 w-2 h-2 bg-lime-600 rounded-full -translate-y-1/2 group-hover/row:bg-lime-600 transition-colors z-10 ring-4 ring-slate-50 group-hover/row:ring-white"></div>
                            </div>

                            <div className="col-span-2 flex items-center pl-2">
                              <span className="font-mono text-xs font-bold text-lime-700 bg-lime-50 border border-lime-600 px-2.5 py-1 rounded shadow-sm">
                                {batch.batch_number}
                              </span>
                            </div>
                            <div className="col-span-2 text-slate-500 font-medium truncate flex items-center">{batch.supplier || "-"}</div>
                            <div className="col-span-2 text-slate-600 flex items-center">{batch.expiry_date || "-"}</div>
                            <div className="col-span-2 text-slate-600 flex items-center">{group.product?.rack_number || "-"}</div>
                            <div className="col-span-1 text-right font-medium flex items-center justify-end text-slate-500">${batch.cost_price.toFixed(2)}</div>
                            <div className="col-span-1 text-right font-medium flex items-center justify-end text-emerald-600">${batch.selling_price.toFixed(2)}</div>
                            <div className="col-span-1 text-right font-black flex items-center justify-end">{batch.qty_available}</div>
                          </div>
                        );
                      })}
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
