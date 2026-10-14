import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { getStoreToday } from "@/lib/storeTime";
import {
  MAX_EXPORT_ROWS, categoryLookupStages, paginationMeta, parsePagination, parseSearch, productLookupStages, round2,
} from "@/lib/reports/common";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "REPORTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const params = new URL(req.url).searchParams;
    const search = parseSearch(params);
    const categoryFilter = (params.get("category") || "").trim().slice(0, 100);
    const { page, limit, skip, isExport } = parsePagination(params);
    const today = await getStoreToday(db, tenantId);

    const batchMatch: any = { tenant_id: tenantId, qty_available: { $gt: 0 } };

    // Resolve product-level filters to product ids up front, so the batch scan can paginate before any join.
    if (categoryFilter) {
      const category = await db.collection("categories").findOne({ tenant_id: tenantId, name: categoryFilter }, { projection: { _id: 1 } });
      const products = category
        ? await db.collection("products").find({ tenant_id: tenantId, category_id: category._id.toString() }, { projection: { _id: 1 } }).toArray()
        : [];
      batchMatch.product_id = { $in: products.map((p) => p._id.toString()) };
    }
    if (search) {
      const re = new RegExp(search, "i");
      const matched = await db.collection("products").find({ tenant_id: tenantId, name: re }, { projection: { _id: 1 } }).limit(5000).toArray();
      batchMatch.$or = [{ product_id: { $in: matched.map((p) => p._id.toString()) } }, { batch_number: re }];
    }

    const isExpiredExpr = {
      $and: [{ $eq: [{ $type: "$expiry_date" }, "string"] }, { $ne: ["$expiry_date", ""] }, { $lt: ["$expiry_date", today] }],
    };
    const cost = { $ifNull: ["$cost_price", 0] };
    const sell = { $ifNull: ["$selling_price", 0] };

    // section=table (paging) skips the metric / chart rollups; section=summary skips the table page.
    const section = params.get("section");
    const wantSummary = !isExport && section !== "table";
    const wantTable = isExport || section !== "summary";

    const [facet] = await db.collection("batches").aggregate([
      { $match: batchMatch },
      {
        $addFields: {
          is_expired: isExpiredExpr,
          total_cost_value: { $multiply: ["$qty_available", cost] },
          expected_revenue: { $multiply: ["$qty_available", sell] },
        },
      },
      {
        $facet: {
          ...(wantSummary && {
          metrics: [
            {
              $group: {
                _id: null,
                total_products: { $addToSet: "$product_id" },
                total_stock_qty: { $sum: "$qty_available" },
                // Everything on hand at cost (what the store owns, incl. expired stock)
                purchase_value: { $sum: "$total_cost_value" },
                // Only stock that can still be sold contributes to expected sales / profit
                selling_value: { $sum: { $cond: ["$is_expired", 0, "$expected_revenue"] } },
                sellable_cost_value: { $sum: { $cond: ["$is_expired", 0, "$total_cost_value"] } },
                expired_value: { $sum: { $cond: ["$is_expired", "$total_cost_value", 0] } },
              },
            },
          ],
          byProduct: [
            {
              $group: {
                _id: "$product_id",
                cost_value: { $sum: "$total_cost_value" },
                selling_value: { $sum: { $cond: ["$is_expired", 0, "$expected_revenue"] } },
                qty: { $sum: "$qty_available" },
              },
            },
            ...productLookupStages(tenantId, "$_id", ["name", "category_id", "rack_number"]),
            ...categoryLookupStages(tenantId),
            { $project: { cost_value: 1, selling_value: 1, qty: 1, name: "$product.name", rack: "$product.rack_number", category: "$category_doc.name" } },
          ],
          }),
          ...(wantTable && {
          table: [
            { $sort: { total_cost_value: -1, _id: 1 } },
            ...(isExport ? [{ $limit: MAX_EXPORT_ROWS }] : [{ $skip: skip }, { $limit: limit }]),
            ...productLookupStages(tenantId, "$product_id", ["name", "category_id", "rack_number"]),
            ...categoryLookupStages(tenantId),
            {
              $project: {
                product_name: { $ifNull: ["$product.name", "Unknown"] },
                category: { $ifNull: ["$category_doc.name", "-"] },
                rack_location: { $ifNull: ["$product.rack_number", "-"] },
                batch_number: 1,
                qty_available: 1,
                cost_price: 1,
                selling_price: 1,
                expiry_date: 1,
                is_expired: 1,
                total_cost_value: 1,
                expected_revenue: 1,
              },
            },
          ],
          count: [{ $count: "total" }],
          }),
        },
      },
    ], { allowDiskUse: true }).toArray();

    const m = facet?.metrics?.[0];
    const metrics = m
      ? {
          total_products: m.total_products.length,
          total_stock_qty: m.total_stock_qty,
          purchase_value: round2(m.purchase_value),
          selling_value: round2(m.selling_value),
          expired_value: round2(m.expired_value),
          expected_profit: round2(m.selling_value - m.sellable_cost_value),
        }
      : { total_products: 0, total_stock_qty: 0, purchase_value: 0, selling_value: 0, expired_value: 0, expected_profit: 0 };

    // Charts derived in memory from the per-product rollup (bounded by the number of products in stock)
    const byProduct: any[] = facet?.byProduct ?? [];
    const categoryMap = new Map<string, { cost_value: number; selling_value: number }>();
    const rackMap = new Map<string, { qty: number; value: number }>();
    for (const p of byProduct) {
      const cat = p.category || "General Health";
      const c = categoryMap.get(cat) ?? { cost_value: 0, selling_value: 0 };
      c.cost_value += p.cost_value;
      c.selling_value += p.selling_value;
      categoryMap.set(cat, c);
      const rackName = p.rack || "Unassigned";
      const r = rackMap.get(rackName) ?? { qty: 0, value: 0 };
      r.qty += p.qty;
      r.value += p.cost_value;
      rackMap.set(rackName, r);
    }

    const totalItemsCount = isExport ? (facet?.table?.length ?? 0) : (facet?.count?.[0]?.total ?? 0);

    return NextResponse.json({
      ...(wantSummary && { metrics, charts: {
        categoryValue: [...categoryMap]
          .map(([name, v]) => ({ name, cost_value: round2(v.cost_value), selling_value: round2(v.selling_value) }))
          .sort((a, b) => b.cost_value - a.cost_value),
        topValuedProducts: [...byProduct]
          .sort((a, b) => b.cost_value - a.cost_value)
          .slice(0, 5)
          .map((p) => ({ name: p.name || "Unknown Product", value: round2(p.cost_value), qty: p.qty })),
        rackDistribution: [...rackMap]
          .map(([rack, v]) => ({ rack, qty: v.qty, value: round2(v.value) }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 6),
      } }),
      ...(wantTable && { table: {
        data: (facet?.table ?? []).map((r: any) => ({
          ...r,
          total_cost_value: round2(r.total_cost_value),
          expected_revenue: round2(r.expected_revenue),
        })),
        pagination: paginationMeta(totalItemsCount, page, limit),
      } }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/reports/inventory-value");
  }
}
