import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import {
  MAX_EXPORT_ROWS, categoryLookupStages, eachDay, getStoreTimezone, marginPct, paginationMeta, parsePagination,
  parseSearch, productLookupStages, reportParamErrorResponse, resolveReportRange, round2, saleLineStages,
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
    const { page, limit, skip, isExport } = parsePagination(params);
    const tz = await getStoreTimezone(db, tenantId);
    const range = resolveReportRange(params, tz);

    const saleMatch = {
      tenant_id: tenantId,
      created_at: { $gte: range.start, $lt: range.end },
    };

    // One row per sold line, with revenue net of line AND bill discounts (pro-rata), excluding tax.
    const basePipeline: any[] = [
      { $match: saleMatch },
      { $project: { created_at: 1, subtotal: 1, discount: 1 } },
      ...saleLineStages(tenantId),
      ...productLookupStages(tenantId, "$items.product_id", ["name", "generic_name", "category_id"]),
    ];

    if (search) {
      const re = new RegExp(search, "i");
      basePipeline.push({ $match: { $or: [{ "product.name": re }, { "product.generic_name": re }] } });
    }
    basePipeline.push(...categoryLookupStages(tenantId));

    const productGroup = {
      $group: {
        _id: "$items.product_id",
        product_name: { $first: "$product.name" },
        category: { $first: "$category_doc.name" },
        qty_sold: { $sum: "$items.qty" },
        total_revenue: { $sum: "$line_net" },
        total_cost: { $sum: "$line_cogs" },
      },
    };
    const tableStages: any[] = [
      productGroup,
      {
        $project: {
          product_name: { $ifNull: ["$product_name", "Unknown Product"] },
          category: { $ifNull: ["$category", "-"] },
          qty_sold: 1,
          total_revenue: 1,
          total_cost: 1,
          profit: { $subtract: ["$total_revenue", "$total_cost"] },
          margin_pct: {
            $cond: [
              { $gt: ["$total_revenue", 0] },
              { $multiply: [{ $divide: [{ $subtract: ["$total_revenue", "$total_cost"] }, "$total_revenue"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { profit: -1, _id: 1 } },
    ];

    // Everything (metrics, charts, table page, count) comes from a single pass over the range.
    const [facetResult] = await db.collection("sales").aggregate([
      ...basePipeline,
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                gross_sales: { $sum: "$line_gross" },
                after_item_discounts: { $sum: "$line_amount" },
                net_revenue: { $sum: "$line_net" },
                product_cost: { $sum: "$line_cogs" },
              },
            },
          ],
          dailyProfitTrend: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } },
                revenue: { $sum: "$line_net" },
                cogs: { $sum: "$line_cogs" },
                profit: { $sum: "$line_profit" },
              },
            },
          ],
          categoryProfit: [
            {
              $group: {
                _id: { $ifNull: ["$category_doc.name", "General Health"] },
                profit: { $sum: "$line_profit" },
                revenue: { $sum: "$line_net" },
              },
            },
            { $sort: { profit: -1 } },
          ],
          topProfitableProducts: [
            {
              $group: {
                _id: "$items.product_id",
                name: { $first: { $ifNull: ["$product.name", "Unknown Medicine"] } },
                profit: { $sum: "$line_profit" },
                revenue: { $sum: "$line_net" },
              },
            },
            { $sort: { profit: -1 } },
            { $limit: 5 },
          ],
          table: [...tableStages, ...(isExport ? [{ $limit: MAX_EXPORT_ROWS }] : [{ $skip: skip }, { $limit: limit }])],
          count: [{ $group: { _id: "$items.product_id" } }, { $count: "total" }],
        },
      },
    ], { allowDiskUse: true }).toArray();

    const m = facetResult?.metrics?.[0] ?? { gross_sales: 0, after_item_discounts: 0, net_revenue: 0, product_cost: 0 };
    const itemDiscTotal = round2(m.gross_sales - m.after_item_discounts);
    const billDiscTotal = round2(m.after_item_discounts - m.net_revenue);
    const grossProfit = round2(m.net_revenue - m.product_cost);
    const metrics = {
      gross_sales: round2(m.gross_sales),
      // Revenue net of all discounts, excluding tax
      gross_revenue: round2(m.net_revenue),
      product_cost: round2(m.product_cost),
      discounts_given: round2(itemDiscTotal + billDiscTotal),
      gross_profit: grossProfit,
      margin_pct: marginPct(grossProfit, m.net_revenue),
    };

    const trendMap = new Map<string, any>((facetResult?.dailyProfitTrend ?? []).map((d: any) => [d._id, d]));
    const totalItemsCount = isExport ? (facetResult?.table?.length ?? 0) : (facetResult?.count?.[0]?.total ?? 0);

    return NextResponse.json({
      metrics,
      charts: {
        dailyProfitTrend: eachDay(range.fromStr, range.toStr).map((date) => ({
          date,
          revenue: round2(trendMap.get(date)?.revenue),
          cogs: round2(trendMap.get(date)?.cogs),
          profit: round2(trendMap.get(date)?.profit),
        })),
        categoryProfit: (facetResult?.categoryProfit ?? []).map((c: any) => ({ name: c._id, profit: round2(c.profit), revenue: round2(c.revenue) })),
        topProfitableProducts: (facetResult?.topProfitableProducts ?? []).map((p: any) => ({ name: p.name, profit: round2(p.profit), revenue: round2(p.revenue) })),
        // Gross sales − discounts − COGS = profit, so the bars add up
        waterfall: [
          { category: "Gross Sales", amount: metrics.gross_sales, fill: "#f59e0b" },
          { category: "Discounts", amount: metrics.discounts_given, fill: "#f97316" },
          { category: "COGS (Stock Cost)", amount: metrics.product_cost, fill: "#ef4444" },
          { category: "Net Profit", amount: metrics.gross_profit, fill: "#10b981" },
        ],
        discountBreakdown: [
          { name: "Item Discounts", amount: itemDiscTotal },
          { name: "Global Invoice Discounts", amount: billDiscTotal },
        ],
      },
      table: {
        data: (facetResult?.table ?? []).map((r: any) => ({
          ...r,
          total_revenue: round2(r.total_revenue),
          total_cost: round2(r.total_cost),
          profit: round2(r.profit),
          margin_pct: round2(r.margin_pct),
        })),
        pagination: paginationMeta(totalItemsCount, page, limit),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return reportParamErrorResponse(error) ?? (await handleApiError(error, "GET /api/reports/profit-loss"));
  }
}
