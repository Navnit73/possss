import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import {
  MAX_EXPORT_ROWS, categoryLookupStages, eachDay, getStoreTimezone, hourlySeries, paginationMeta, parsePagination,
  parseSearch, productLookupStages, reportParamErrorResponse, resolveReportRange, round2, saleLineStages,
} from "@/lib/reports/common";

const PAYMENT_METHODS = ["CASH", "CARD", "UPI", "OTHER"];

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
    const paymentMethod = (params.get("paymentMethod") || "").toUpperCase();
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }
    const { page, limit, skip, isExport } = parsePagination(params);
    const tz = await getStoreTimezone(db, tenantId);
    const range = resolveReportRange(params, tz);

    // 1. Sales match (store-timezone calendar days, end exclusive)
    const saleMatch: any = {
      tenant_id: tenantId,
      created_at: { $gte: range.start, $lt: range.end },
    };
    if (paymentMethod) saleMatch.payment_method = paymentMethod;
    if (search) saleMatch.invoice_no = { $regex: new RegExp(search, "i") };

    // 2. Invoice-level figures: one pass over the matching sales
    const salesFacetPipeline = [
      { $match: saleMatch },
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                total_revenue: { $sum: "$total" },
                total_orders: { $sum: 1 },
                total_tax: { $sum: "$tax" },
                total_discount: { $sum: "$discount" },
              },
            },
          ],
          daily: [
            {
              $group: {
                _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } }, method: "$payment_method" },
                revenue: { $sum: "$total" },
                orders: { $sum: 1 },
              },
            },
          ],
          payments: [{ $group: { _id: "$payment_method", revenue: { $sum: "$total" }, count: { $sum: 1 } } }, { $sort: { revenue: -1 } }],
          hourly: [{ $group: { _id: { $hour: { date: "$created_at", timezone: tz } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }],
          customerType: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $and: [{ $ne: [{ $ifNull: ["$customer_id", null] }, null] }, { $ne: ["$customer_id", ""] }] },
                    "Registered Patient",
                    "Walk-in Customer",
                  ],
                },
                revenue: { $sum: "$total" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    // 3. Line-level figures (products, categories, profit, qty) — one pass with tenant-scoped joins
    const itemsFacetPipeline = [
      { $match: saleMatch },
      { $project: { created_at: 1, subtotal: 1, discount: 1 } },
      ...saleLineStages(tenantId),
      {
        $facet: {
          topProducts: [
            { $group: { _id: "$items.product_id", qty_sold: { $sum: "$items.qty" }, revenue: { $sum: "$line_net" } } },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            ...productLookupStages(tenantId, "$_id", ["name"]),
          ],
          categoryBreakdown: [
            { $group: { _id: "$items.product_id", revenue: { $sum: "$line_net" }, qty: { $sum: "$items.qty" } } },
            ...productLookupStages(tenantId, "$_id", ["category_id"]),
            ...categoryLookupStages(tenantId),
            { $group: { _id: { $ifNull: ["$category_doc.name", "General Health"] }, revenue: { $sum: "$revenue" }, qty: { $sum: "$qty" } } },
            { $sort: { revenue: -1 } },
          ],
          dailyProfit: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } },
                profit: { $sum: "$line_profit" },
              },
            },
          ],
          totals: [{ $group: { _id: null, total_qty: { $sum: "$items.qty" }, total_rows: { $sum: 1 } } }],
        },
      },
    ];

    // 4. Register table: sort + paginate before the product / batch joins so only one page is joined
    const tablePipeline: any[] = [
      { $match: saleMatch },
      { $sort: { created_at: -1, _id: -1 } },
      { $project: { invoice_no: 1, created_at: 1, payment_method: 1, discount: 1, tax: 1, total: 1, subtotal: 1 } },
      ...saleLineStages(tenantId),
      ...(isExport ? [{ $limit: MAX_EXPORT_ROWS }] : [{ $skip: skip }, { $limit: limit }]),
      ...productLookupStages(tenantId, "$items.product_id", ["name"]),
      { $addFields: { _bid: { $convert: { input: "$items.batch_id", to: "objectId", onError: null, onNull: null } } } },
      {
        $lookup: {
          from: "batches",
          localField: "_bid",
          foreignField: "_id",
          pipeline: [{ $match: { tenant_id: tenantId } }, { $project: { batch_number: 1 } }],
          as: "batch",
        },
      },
      { $unwind: { path: "$batch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: "$items._id",
          invoice_no: 1,
          created_at: 1,
          payment_method: 1,
          product_name: { $ifNull: ["$product.name", "Unknown Product"] },
          batch_number: { $ifNull: ["$batch.batch_number", "N/A"] },
          qty: "$items.qty",
          price: "$items.price",
          item_discount: { $ifNull: ["$items.discount", 0] },
          sale_discount: "$discount",
          sale_tax: "$tax",
          sale_total: "$total",
          // Line profit after its share of the bill discount
          profit: "$line_profit",
        },
      },
    ];

    // section=table (paging) skips the chart aggregations; section=summary skips the register page.
    const section = params.get("section");
    const wantSummary = isExport ? false : section !== "table";
    const wantTable = isExport || section !== "summary";

    if (!wantSummary) {
      const [tableRows, countRes] = await Promise.all([
        db.collection("sales").aggregate(tablePipeline, { allowDiskUse: true }).toArray(),
        isExport
          ? Promise.resolve([])
          : db.collection("sales").aggregate([
              { $match: saleMatch },
              { $project: { _sid: { $toString: "$_id" } } },
              { $lookup: { from: "sale_items", localField: "_sid", foreignField: "sale_id", pipeline: [{ $project: { _id: 1 } }], as: "items" } },
              { $group: { _id: null, n: { $sum: { $size: "$items" } } } },
            ]).toArray(),
      ]);
      const total = isExport ? tableRows.length : (countRes[0]?.n ?? 0);
      return NextResponse.json({
        table: {
          data: tableRows.map((r: any) => ({ ...r, profit: round2(r.profit) })),
          pagination: paginationMeta(total, page, limit),
        },
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const [salesFacet, itemsFacet, tableRows] = await Promise.all([
      db.collection("sales").aggregate(salesFacetPipeline).toArray(),
      db.collection("sales").aggregate(itemsFacetPipeline, { allowDiskUse: true }).toArray(),
      wantTable ? db.collection("sales").aggregate(tablePipeline, { allowDiskUse: true }).toArray() : Promise.resolve([]),
    ]);

    const sf = salesFacet[0] ?? { metrics: [], daily: [], payments: [], hourly: [], customerType: [] };
    const itf = itemsFacet[0] ?? { topProducts: [], categoryBreakdown: [], dailyProfit: [], totals: [] };
    const metrics = sf.metrics[0] || { total_revenue: 0, total_orders: 0, total_tax: 0, total_discount: 0 };
    const avgOrderValue = metrics.total_orders > 0 ? metrics.total_revenue / metrics.total_orders : 0;

    const profitMap = new Map<string, number>(itf.dailyProfit.map((p: any) => [p._id, p.profit]));

    // Daily trend with payment method breakdown, one point per calendar day
    const trendMap = new Map<string, any>();
    for (const date of eachDay(range.fromStr, range.toStr)) {
      trendMap.set(date, { date, revenue: 0, orders: 0, cash: 0, card: 0, upi: 0, other: 0, profit: round2(profitMap.get(date)) });
    }
    for (const item of sf.daily) {
      const entry = trendMap.get(item._id.date);
      if (!entry) continue;
      const method = (item._id.method || "OTHER").toString().toUpperCase();
      entry.revenue += item.revenue;
      entry.orders += item.orders;
      if (method === "CASH") entry.cash += item.revenue;
      else if (method === "CARD") entry.card += item.revenue;
      else if (method === "UPI") entry.upi += item.revenue;
      else entry.other += item.revenue;
    }
    let maxDayRevenue = 0;
    let bestDayDate = "N/A";
    const dailyTrend = Array.from(trendMap.values()).map((e) => {
      if (e.revenue > maxDayRevenue) {
        maxDayRevenue = e.revenue;
        bestDayDate = e.date;
      }
      return { ...e, revenue: round2(e.revenue), cash: round2(e.cash), card: round2(e.card), upi: round2(e.upi), other: round2(e.other) };
    });

    const totals = itf.totals[0] ?? { total_qty: 0, total_rows: 0 };
    const totalItemsCount = totals.total_rows;

    return NextResponse.json({
      metrics: {
        // Invoice totals collected (incl. tax); tax and discounts are reported separately
        totalRevenue: round2(metrics.total_revenue),
        totalTax: round2(metrics.total_tax),
        totalDiscount: round2(metrics.total_discount),
        totalOrders: metrics.total_orders,
        avgOrderValue: round2(avgOrderValue),
        totalQtySold: totals.total_qty,
        bestDay: bestDayDate,
        bestDayRevenue: round2(maxDayRevenue),
      },
      charts: {
        dailyTrend,
        paymentMethods: sf.payments.map((p: any) => ({ method: p._id || "OTHER", revenue: round2(p.revenue), count: p.count })),
        hourlyTrend: hourlySeries(sf.hourly),
        customerType: sf.customerType.map((c: any) => ({ name: c._id, revenue: round2(c.revenue), count: c.count })),
        topProducts: itf.topProducts.map((p: any) => ({ name: p.product?.name || "Unknown Medicine", revenue: round2(p.revenue), qty: p.qty_sold })),
        categoryBreakdown: itf.categoryBreakdown.map((c: any) => ({ name: c._id, revenue: round2(c.revenue), qty: c.qty })),
      },
      ...(wantTable && {
        table: {
          data: tableRows.map((r: any) => ({ ...r, profit: round2(r.profit) })),
          pagination: paginationMeta(totalItemsCount, page, limit),
        },
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return reportParamErrorResponse(error) ?? (await handleApiError(error, "GET /api/reports/sales"));
  }
}
