"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Package, Search, AlertTriangle, PackageX, TrendingDown, CheckCircle2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, StatCard, EmptyState } from "@/components/ui/Page";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { InfiniteListFooter } from "@/components/ui/InfiniteListFooter";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

type Summary = { low_stock: number; out_of_stock: number; units_short: number };

export default function LowStockAlertsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const { items, total, hasMore, isLoading, isLoadingMore, error, loadMore, sentinelRef, response } =
    useInfiniteList<any>("/api/inventory/low-stock", {
      params: { q: debouncedSearch || undefined },
      errorMessage: "Failed to load alerts",
    });

  const summary = response?.summary as Summary | undefined;
  const hasAnyAlerts = (summary?.low_stock ?? 0) > 0;

  return (
    <PageShell>
      <PageHeader
        title="Low Stock Alerts"
        description="Products whose sellable (non-expired) stock is at or below their minimum stock threshold."
        actions={
          <Link href="/dashboard/inventory/add-stock" className={buttonClasses()}>
            <Plus aria-hidden="true" />
            Receive Stock
          </Link>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      {/* KPI Cards — across all alerts, independent of the search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label="Products needing reorder"
          value={summary ? summary.low_stock.toLocaleString() : "–"}
          icon={AlertTriangle}
          tone={hasAnyAlerts ? "warning" : "default"}
        />
        <StatCard
          label="Out of stock"
          value={summary ? summary.out_of_stock.toLocaleString() : "–"}
          icon={PackageX}
          tone={(summary?.out_of_stock ?? 0) > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Units short of minimum"
          value={summary ? summary.units_short.toLocaleString() : "–"}
          icon={TrendingDown}
        />
      </div>

      <Card className="overflow-hidden flex flex-col">
        {/* Search Toolbar */}
        <div className="p-4 border-b border-hairline flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-ink-48" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Search alerts"
              placeholder="Search by name, generic name, strength, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {search && (
            <Button variant="link" size="sm" onClick={() => setSearch("")} className="gap-1">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Reset
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={7} rows={6} />
          </div>
        ) : items.length === 0 ? (
          debouncedSearch && hasAnyAlerts ? (
            <EmptyState
              icon={Package}
              title="No matching alerts"
              description="Try adjusting your search terms."
              className="py-16"
            />
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="All stock levels optimal"
              description="There are no products currently running low on stock."
              className="py-16"
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product name</TableHead>
                <TableHead>Rack</TableHead>
                <TableHead className="text-right">Min stock</TableHead>
                <TableHead className="text-right">Current stock</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => {
                const current = Number(item.total_stock || 0);
                const min = Number(item.minimum_stock || 0);
                const isOut = current <= 0;
                const shortfall = Math.max(min - current, 0);

                return (
                  <TableRow key={item._id}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/dashboard/products/${item._id}`} className="font-semibold text-primary hover:underline">
                          {item.name}
                        </Link>
                        {item.strength && <Badge variant="outline">{item.strength}</Badge>}
                      </div>
                      {(item.generic_name || item.sku) && (
                        <p className="text-fine-print text-ink-48 mt-0.5">
                          {item.generic_name}
                          {item.generic_name && item.sku && " · "}
                          {item.sku && <span className="font-mono">{item.sku}</span>}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.rack_number || <span className="text-ink-48">-</span>}
                    </TableCell>
                    <TableCell className="text-right tabular text-ink-48">
                      {min.toLocaleString()}
                    </TableCell>
                    <TableCell className={cn("text-right tabular font-semibold", isOut ? "text-destructive" : "text-warning")}>
                      {current.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular font-semibold text-ink">
                      {shortfall > 0 ? shortfall.toLocaleString() : <span className="text-ink-48 font-normal">-</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isOut ? "destructive" : "warning"}>
                        {isOut ? "Out of Stock" : "Low Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/inventory/add-stock?product_id=${item._id}`}
                        className={buttonClasses({ variant: "secondary" })}
                      >
                        <Plus aria-hidden="true" />
                        Reorder
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!isLoading && items.length > 0 && (
          <InfiniteListFooter
            sentinelRef={sentinelRef}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            loaded={items.length}
            total={total}
            noun="alerts"
            onLoadMore={loadMore}
          />
        )}
      </Card>
    </PageShell>
  );
}
