import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import {
  MAX_EXPORT_ROWS, categoryLookupStages, getStoreTimezone, paginationMeta, parsePagination, parseSearch,
  productLookupStages, reportParamErrorResponse, resolveReportRange, round2, saleLineStages,
} from "@/lib/reports/common";

/** Stock-days value used when a product didn't sell in the period (shown as ∞). */
const NO_SALES_STOCK_DAYS = 9999;
const AT_RISK_DAYS = 14;

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
    const todayStr = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");

    // Average over the days that have actually elapsed ("This Month" on the 5th is 5 days, not 31)
    const lastDay = range.toStr < todayStr ? range.toStr : todayStr;
    const daysInPeriod = Math.max(1, differenceInCalendarDays(parseISO(lastDay), parseISO(range.fromStr)) + 1);

    const basePipeline: any[] = [
      { $match: { tenant_id: tenantId, created_at: { $gte: range.start, $lt: range.end } } },
      { $project: { created_at: 1, subtotal: 1, discount: 1 } },
      ...saleLineStages(tenantId),
      ...productLookupStages(tenantId, "$items.product_id", ["name", "category_id"]),
    ];
    if (search) basePipeline.push({ $match: { "product.name": new RegExp(search, "i") } });

    const groupedBase = [
      ...basePipeline,
      {
        $group: {
          _id: "$items.product_id",
          product_name: { $first: { $ifNull: ["$product.name", "Unknown Product"] } },
          product: { $first: "$product" },
          qty_sold: { $sum: "$items.qty" },
          revenue_generated: { $sum: "$line_net" },
          profit_generated: { $sum: "$line_profit" },
        },
      },
      ...categoryLookupStages(tenantId),
      {
        // Sellable stock only: this tenant's batches with stock that haven't expired (store timezone)
        $lookup: {
          from: "batches",
          localField: "_id",
          foreignField: "product_id",
          pipeline: [
            {
              $match: {
                tenant_id: tenantId,
                qty_available: { $gt: 0 },
                $or: [{ expiry_date: { $exists: false } }, { expiry_date: null }, { expiry_date: "" }, { expiry_date: { $gte: todayStr } }],
              },
            },
            { $group: { _id: null, current_stock: { $sum: "$qty_available" } } },
          ],
          as: "stock",
        },
      },
      {
        $project: {
          product_name: 1,
          category: { $ifNull: ["$category_doc.name", "General Health"] },
          qty_sold: 1,
          revenue_generated: 1,
          profit_generated: 1,
          current_stock: { $ifNull: [{ $arrayElemAt: ["$stock.current_stock", 0] }, 0] },
          avg_daily_sales: { $divide: ["$qty_sold", daysInPeriod] },
        },
      },
      {
        $addFields: {
          estimated_stock_days: {
            $cond: [{ $gt: ["$avg_daily_sales", 0] }, { $divide: ["$current_stock", "$avg_daily_sales"] }, NO_SALES_STOCK_DAYS],
          },
        },
      },
      { $sort: { qty_sold: -1, _id: 1 } },
    ];

    // Metrics, charts, the table page and the count from a single pass
    const [facet] = await db.collection("sales").aggregate([
      ...groupedBase,
      {
        $facet: {
          topUnits: [{ $limit: 10 }, { $project: { name: "$product_name", qty_sold: 1, revenue: "$revenue_generated" } }],
          categoryVelocity: [
            { $group: { _id: "$category", total_qty: { $sum: "$qty_sold" }, total_revenue: { $sum: "$revenue_generated" } } },
            { $sort: { total_qty: -1 } },
          ],
          atRiskTop: [
            { $match: { estimated_stock_days: { $lt: AT_RISK_DAYS } } },
            { $sort: { estimated_stock_days: 1, qty_sold: -1 } },
            { $limit: 5 },
          ],
          atRiskCount: [{ $match: { estimated_stock_days: { $lt: AT_RISK_DAYS } } }, { $count: "n" }],
          table: isExport ? [{ $limit: MAX_EXPORT_ROWS }] : [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: "total" }],
        },
      },
    ], { allowDiskUse: true }).toArray();

    const atRiskTop = facet?.atRiskTop ?? [];
    const atRiskCount = facet?.atRiskCount?.[0]?.n ?? 0;
    const totalItemsCount = facet?.count?.[0]?.total ?? 0;
    const topUnits = (facet?.topUnits ?? []).map((p: any) => ({ ...p, revenue: round2(p.revenue) }));

    return NextResponse.json({
      metrics: {
        topPerformers: topUnits.slice(0, 3).map((p: any) => p.name),
        totalAnalyzed: totalItemsCount,
        atRiskCount,
      },
      charts: {
        topUnits,
        categoryVelocity: (facet?.categoryVelocity ?? []).map((c: any) => ({
          name: c._id || "General Health",
          qty: c.total_qty,
          revenue: round2(c.total_revenue),
        })),
        atRiskStockouts: atRiskTop.map((p: any) => ({
          name: p.product_name,
          qty_sold: p.qty_sold,
          current_stock: p.current_stock,
          days_left: round2(p.estimated_stock_days),
        })),
      },
      table: {
        data: (facet?.table ?? []).map((r: any) => ({
          ...r,
          revenue_generated: round2(r.revenue_generated),
          profit_generated: round2(r.profit_generated),
          avg_daily_sales: round2(r.avg_daily_sales),
          estimated_stock_days: r.estimated_stock_days === NO_SALES_STOCK_DAYS ? NO_SALES_STOCK_DAYS : round2(r.estimated_stock_days),
        })),
        pagination: paginationMeta(totalItemsCount, page, limit),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return reportParamErrorResponse(error) ?? (await handleApiError(error, "GET /api/reports/fast-moving"));
  }
}
