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
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { PageShell, StatCard, EmptyState, Chip } from "@/components/ui/Page";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCurrency } from "@/context/CurrencyContext";
import { format } from "date-fns";

// A batch with no expiry never expires; dates are "yyyy-MM-dd" strings (same rule as POS)
const isBatchExpired = (expiry: unknown, today: string) =>
  typeof expiry === "string" && expiry.trim() !== "" && expiry < today;

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

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Group batches by product. sellableQty excludes expired batches (they can't be sold at POS),
  // so the low-stock status here matches the Low Stock Alerts page.
  const groupedStock = useMemo(() => {
    return batches.reduce((acc: Record<string, any>, batch: any) => {
      const pId = batch.product?._id || batch.product_id || "unknown";
      if (!acc[pId]) {
        acc[pId] = {
          pId,
          product: batch.product,
          totalQty: 0,
          sellableQty: 0,
          batches: []
        };
      }
      const qty = Number(batch.qty_available || 0);
      acc[pId].totalQty += qty;
      if (!isBatchExpired(batch.expiry_date, todayStr)) acc[pId].sellableQty += qty;
      acc[pId].batches.push(batch);
      return acc;
    }, {});
  }, [batches, todayStr]);

  // Filter grouped stock based on search & category
  const filteredGroupedStock = useMemo(() => {
    const term = search.trim().toLowerCase();

    return Object.values(groupedStock).filter((group: any) => {
      const prodName = (group.product?.name || "").toLowerCase();
      const prodStrength = (group.product?.strength || "").toLowerCase();
      const catName = (group.product?.category?.name || "Uncategorized").toLowerCase();
      const catId = group.product?.category_id || group.product?.category?._id || "";
      const minStock = Number(group.product?.minimum_stock || 0);
      const isLowStock = group.sellableQty <= minStock;

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
      if (group.sellableQty <= minStock) {
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
    <PageShell>
      <PageHeader 
        title="Stock List"
        description="Manage inventory levels across all product batches."
        actions={
          <Link href="/dashboard/inventory/add-stock" className={buttonClasses({})}>
            <Plus aria-hidden="true" />
            Receive Stock
          </Link>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Total products" value={stats.totalProducts} icon={Package} />
        <StatCard label="Total units in stock" value={stats.totalStockItems.toLocaleString()} icon={CheckCircle2} />
        <StatCard
          label="Low stock alerts"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          tone={stats.lowStockCount > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Search & Filters Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 lg:items-center">
        <div className="flex-1 flex flex-wrap gap-3 items-center w-full">
          
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
            <Input 
              type="text" 
              placeholder="Search product, strength, batch #, supplier..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-ink-48 shrink-0" aria-hidden="true" />
            <Select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-[200px]"
            >
              <option value="All">All Categories</option>
              {categories.map((c: any) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {[
              { value: "All", label: "All Statuses" },
              { value: "IN_STOCK", label: "In Stock" },
              { value: "LOW", label: "Low Stock" },
            ].map((opt) => (
              <Chip
                key={opt.value}
                selected={selectedStatus === opt.value}
                onClick={() => setSelectedStatus(opt.value)}
              >
                {opt.label}
              </Chip>
            ))}
          </div>

          {(search || selectedCategory !== "All" || selectedStatus !== "All") && (
            <Button 
              variant="link" 
              size="sm" 
              onClick={() => { setSearch(""); setSelectedCategory("All"); setSelectedStatus("All"); }}
              className="gap-1"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" /> Reset
            </Button>
          )}
        </div>

        {filteredGroupedStock.length > 0 && (
          <Button 
            variant="secondary" 
            onClick={toggleExpandAll}
            className="gap-1 self-start lg:self-auto"
          >
            <ChevronsUpDown aria-hidden="true" />
            {expandedProducts.size > 0 ? "Collapse All" : "Expand All"}
          </Button>
        )}
      </div>

      {/* Stock Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={5} rows={6} />
          </div>
        ) : filteredGroupedStock.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No matching inventory found"
            description="Try adjusting your search terms or category filters."
            action={
              <Link href="/dashboard/inventory/add-stock" className={buttonClasses({})}>
                <Plus aria-hidden="true" /> Receive First Batch
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <div className="min-w-[760px] text-caption text-ink">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 h-11 items-center text-caption font-semibold text-ink-48 border-b border-hairline">
              <div className="col-span-1"></div>
              <div className="col-span-4">Product name</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2 text-right">Total stock</div>
              <div className="col-span-2 text-center">Status</div>
            </div>

            {/* Grouped Rows */}
            {filteredGroupedStock.map((group: any) => {
              const pId = group.pId;
              const isExpanded = expandedProducts.has(pId);
              const minStock = Number(group.product?.minimum_stock || 0);
              const isLowStock = group.sellableQty <= minStock;

              return (
                <div key={pId} className="flex flex-col border-b border-divider-soft last:border-0">
                  {/* Product Parent Row */}
                  <div 
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    className={cn(
                      "grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer",
                      isExpanded && "bg-parchment"
                    )}
                    onClick={() => toggleExpand(pId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(pId);
                      }
                    }}
                  >
                    <div className="col-span-1 flex justify-center text-ink-48">
                      {isExpanded ? <ChevronDown className="size-5" aria-hidden="true" /> : <ChevronRight className="size-5" aria-hidden="true" />}
                    </div>
                    <div className="col-span-4 text-body font-semibold text-ink flex items-center gap-2">
                      {group.product?.name || "Unknown Product"}
                      {group.product?.strength && (
                        <Badge variant="outline">{group.product.strength}</Badge>
                      )}
                    </div>
                    <div className="col-span-3 text-ink-48">
                      {group.product?.category?.name || "Uncategorized"}
                    </div>
                    <div className="col-span-2 text-right text-body font-semibold tabular text-ink flex items-center justify-end gap-2">
                      {group.totalQty.toLocaleString()}
                      {isLowStock && (
                        <span title={`Low Stock (Min: ${minStock})`}>
                          <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Badge variant={isLowStock ? "destructive" : "success"}>
                        {isLowStock ? 'Low Stock' : 'In Stock'}
                      </Badge>
                    </div>
                  </div>

                  {/* Batches Child Rows */}
                  {isExpanded && (
                    <div className="bg-parchment pb-3">
                      {/* Child Table Header */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-caption font-semibold text-ink-48">
                        <div className="col-span-1 relative">
                          <div className="absolute left-1/2 top-0 w-px bg-hairline -translate-x-1/2 h-full"></div>
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
                          <div key={batch._id} className="grid grid-cols-12 gap-4 px-4 py-2 text-caption text-ink">
                            
                            {/* Visual Tree Node Column */}
                            <div className="col-span-1 relative flex items-center min-h-9">
                              <div className={cn("absolute left-1/2 top-0 w-px bg-hairline -translate-x-1/2", isLast ? "h-1/2" : "h-full")}></div>
                              <div className="absolute left-1/2 top-1/2 w-[calc(50%+16px)] h-px bg-hairline"></div>
                            </div>

                            <div className="col-span-2 flex items-center pl-2">
                              <span className="font-mono text-fine-print text-ink-80 bg-canvas border border-hairline px-2.5 py-1 rounded-xs">
                                {batch.batch_number}
                              </span>
                            </div>
                            <div className="col-span-2 text-ink-48 truncate flex items-center">
                              {batch.supplier || "-"}
                            </div>
                            <div className="col-span-2 text-ink-80 tabular flex items-center gap-2">
                              {batch.expiry_date || "-"}
                              {isBatchExpired(batch.expiry_date, todayStr) && (
                                <Badge variant="destructive" className="bg-canvas">Expired</Badge>
                              )}
                            </div>
                            <div className="col-span-2 text-ink-80 flex items-center">
                              {group.product?.rack_number || "-"}
                            </div>
                            <div className="col-span-1 text-right tabular flex items-center justify-end text-ink-48">
                              {formatCurrency(batch.cost_price)}
                            </div>
                            <div className="col-span-1 text-right tabular font-semibold flex items-center justify-end text-ink">
                              {formatCurrency(batch.selling_price)}
                            </div>
                            <div className="col-span-1 text-right tabular font-semibold flex items-center justify-end text-ink">
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
          </div>
        )}
      </Card>
    </PageShell>
  );
}
