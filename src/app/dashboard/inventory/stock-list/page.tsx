"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Package, 
  AlertCircle, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  ChevronsUpDown
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCurrency } from "@/context/CurrencyContext";

export default function StockListPage() {
  const { formatCurrency } = useCurrency();
  const [batches, setBatches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchRes, catRes] = await Promise.all([
          axios.get("/api/inventory/batches"),
          axios.get("/api/categories")
        ]);
        setBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load stock inventory data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Group batches by product
  const groupedStock = useMemo(() => {
    return batches.reduce((acc: Record<string, any>, batch: any) => {
      const pId = batch.product?._id || batch.product_id || "unknown";
      if (!acc[pId]) {
        acc[pId] = {
          pId,
          product: batch.product,
          totalQty: 0,
          batches: []
        };
      }
      acc[pId].totalQty += Number(batch.qty_available || 0);
      acc[pId].batches.push(batch);
      return acc;
    }, {});
  }, [batches]);

  // Filter grouped stock based on search & category
  const filteredGroupedStock = useMemo(() => {
    const term = search.trim().toLowerCase();

    return Object.values(groupedStock).filter((group: any) => {
      const prodName = (group.product?.name || "").toLowerCase();
      const prodStrength = (group.product?.strength || "").toLowerCase();
      const catName = (group.product?.category?.name || "Uncategorized").toLowerCase();
      const catId = group.product?.category_id || group.product?.category?._id || "";
      const minStock = Number(group.product?.minimum_stock || 0);
      const isLowStock = group.totalQty <= minStock;

      // Category filter
      if (selectedCategory !== "All" && catId !== selectedCategory && catName !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Status filter
      if (selectedStatus === "LOW" && !isLowStock) return false;
      if (selectedStatus === "IN_STOCK" && isLowStock) return false;

      // Search term filter
      if (!term) return true;

      const matchesProduct = prodName.includes(term) || prodStrength.includes(term) || catName.includes(term);
      const matchesBatch = group.batches.some((b: any) => 
        (b.batch_number || "").toLowerCase().includes(term) ||
        (b.supplier || "").toLowerCase().includes(term)
      );

      return matchesProduct || matchesBatch;
    });
  }, [groupedStock, search, selectedCategory, selectedStatus]);

  // KPI Calculations
  const stats = useMemo(() => {
    const allGroups = Object.values(groupedStock);
    const totalProducts = allGroups.length;
    let totalStockItems = 0;
    let lowStockCount = 0;

    allGroups.forEach((group: any) => {
      totalStockItems += group.totalQty;
      const minStock = Number(group.product?.minimum_stock || 0);
      if (group.totalQty <= minStock) {
        lowStockCount++;
      }
    });

    return { totalProducts, totalStockItems, lowStockCount };
  }, [groupedStock]);

  const toggleExpand = (pId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(pId)) {
      newSet.delete(pId);
    } else {
      newSet.add(pId);
    }
    setExpandedProducts(newSet);
  };

  const toggleExpandAll = () => {
    if (expandedProducts.size > 0) {
      setExpandedProducts(new Set());
    } else {
      const allIds = filteredGroupedStock.map((g: any) => g.pId);
      setExpandedProducts(new Set(allIds));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Stock List"
        description="Manage inventory levels across all product batches."
        actions={
          <Link href="/dashboard/inventory/add-stock">
            <Button className="gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm">
              <Plus className="w-4 h-4" />
              Receive Stock
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="p-4 text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-200 font-medium">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalProducts}</h3>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-slate-700">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Units In Stock</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.totalStockItems.toLocaleString()}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{stats.lowStockCount}</h3>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 items-center shadow-sm">
        <div className="flex-1 max-w-4xl flex flex-wrap gap-3 items-center w-full">
          
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              type="text" 
              placeholder="Search product, strength, batch #, supplier..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <Select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-[160px] text-sm bg-white border-slate-200"
            >
              <option value="All">All Categories</option>
              {categories.map((c: any) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-[140px] text-sm bg-white border-slate-200"
            >
              <option value="All">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW">Low Stock</option>
            </Select>
          </div>

          {(search || selectedCategory !== "All" || selectedStatus !== "All") && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setSearch(""); setSelectedCategory("All"); setSelectedStatus("All"); }}
              className="text-xs text-slate-500 hover:text-slate-900 gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>

        {filteredGroupedStock.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleExpandAll}
            className="text-xs font-semibold gap-1 whitespace-nowrap border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            {expandedProducts.size > 0 ? "Collapse All" : "Expand All"}
          </Button>
        )}
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={6} />
          </div>
        ) : filteredGroupedStock.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <Package className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-base font-bold text-slate-800 mb-1">No matching inventory found</p>
            <p className="text-sm text-slate-500 max-w-sm mb-4">
              Try adjusting your search terms or category filters.
            </p>
            <Link href="/dashboard/inventory/add-stock">
              <Button size="sm" className="gap-2 bg-slate-900 text-white">
                <Plus className="w-4 h-4" /> Receive First Batch
              </Button>
            </Link>
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
            {filteredGroupedStock.map((group: any) => {
              const pId = group.pId;
              const isExpanded = expandedProducts.has(pId);
              const minStock = Number(group.product?.minimum_stock || 0);
              const isLowStock = group.totalQty <= minStock;

              return (
                <div key={pId} className="flex flex-col border-b border-slate-100 last:border-0 group/parent">
                  {/* Product Parent Row */}
                  <div 
                    className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${
                      isExpanded ? 'bg-emerald-50/70 hover:bg-emerald-100/60' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => toggleExpand(pId)}
                  >
                    <div className="col-span-1 flex justify-center text-slate-400">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isExpanded ? 'bg-emerald-200 text-emerald-800 shadow-sm border border-emerald-300' : 'hover:bg-slate-200 text-slate-600'
                      }`}>
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                    </div>
                    <div className="col-span-4 font-bold text-slate-900 flex items-center gap-2">
                      {group.product?.name || "Unknown Product"}
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
                      {group.totalQty.toLocaleString()}
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

                  {/* Batches Child Rows (Green Tree UI) */}
                  {isExpanded && (
                    <div className="bg-emerald-50/30 pb-4 shadow-inner border-t border-emerald-100">
                      {/* Child Table Header */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider relative">
                        {/* Connecting vertical line for header */}
                        <div className="col-span-1 relative">
                          <div className="absolute left-1/2 top-0 w-[2px] bg-emerald-600 -translate-x-1/2 h-full"></div>
                        </div>
                        <div className="col-span-2">Batch #</div>
                        <div className="col-span-2">Supplier</div>
                        <div className="col-span-2">Expiry</div>
                        <div className="col-span-2">Rack</div>
                        <div className="col-span-1 text-right">Cost</div>
                        <div className="col-span-1 text-right">Price</div>
                        <div className="col-span-1 text-right">Qty</div>
                      </div>

                      {/* Child Rows with Green Tree Branches */}
                      {group.batches.map((batch: any, index: number) => {
                        const isLast = index === group.batches.length - 1;

                        return (
                          <div key={batch._id} className="grid grid-cols-12 gap-4 px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50/80 cursor-pointer transition-colors group/row">
                            
                            {/* Visual Tree Node Column */}
                            <div className="col-span-1 relative flex items-center min-h-[36px]">
                              {/* Vertical tree line */}
                              <div className={`absolute left-1/2 top-0 w-[2px] bg-emerald-600 -translate-x-1/2 ${isLast ? 'h-[50%]' : 'h-full'}`}></div>
                              
                              {/* Horizontal branch line */}
                              <div className="absolute left-1/2 top-1/2 w-[calc(50%+16px)] h-[2px] bg-emerald-600"></div>
                              
                              {/* Tree node dot */}
                              <div className="absolute right-[-20px] top-1/2 w-2 h-2 bg-emerald-600 rounded-full -translate-y-1/2 group-hover/row:bg-emerald-700 transition-colors z-10 ring-4 ring-emerald-50 group-hover/row:ring-white"></div>
                            </div>

                            <div className="col-span-2 flex items-center pl-2">
                              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded shadow-sm">
                                {batch.batch_number}
                              </span>
                            </div>
                            <div className="col-span-2 text-slate-500 font-medium truncate flex items-center">
                              {batch.supplier || "-"}
                            </div>
                            <div className="col-span-2 text-slate-600 flex items-center">
                              {batch.expiry_date || "-"}
                            </div>
                            <div className="col-span-2 text-slate-600 flex items-center">
                              {group.product?.rack_number || "-"}
                            </div>
                            <div className="col-span-1 text-right font-medium flex items-center justify-end text-slate-500">
                              {formatCurrency(batch.cost_price)}
                            </div>
                            <div className="col-span-1 text-right font-bold flex items-center justify-end text-emerald-700">
                              {formatCurrency(batch.selling_price)}
                            </div>
                            <div className="col-span-1 text-right font-black flex items-center justify-end text-slate-900">
                              {batch.qty_available}
                            </div>
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
