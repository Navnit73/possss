import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { addDays, format, parseISO, differenceInCalendarDays, isValid, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Calendar-date math on "yyyy-MM-dd" strings (timezone-free).
const shiftDay = (dateStr: string, days: number) => format(addDays(parseISO(dateStr), days), "yyyy-MM-dd");

function resolveTimezone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// Line revenue after the line-level discount — same definition as the Profit & Loss report.
const lineRevenueExpr = (prefix: string) => ({
  $multiply: [
    { $ifNull: [`${prefix}.price`, 0] },
    { $ifNull: [`${prefix}.qty`, 0] },
    { $subtract: [1, { $divide: [{ $ifNull: [`${prefix}.discount`, 0] }, 100] }] },
  ],
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Same rule the proxy uses to let someone onto /dashboard (OWNER always passes)
    const permError = checkPermission(session, "REPORTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId || !ObjectId.isValid(tenantId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const url = new URL(req.url);

    // Validate before any queries start, so an early return never leaves promises un-awaited
    const dateRange = url.searchParams.get("dateRange") || "today";
    const customStart = url.searchParams.get("startDate") || "";
    const customEnd = url.searchParams.get("endDate") || "";
    if (dateRange === "custom" && (
      !DATE_RE.test(customStart) || !DATE_RE.test(customEnd)
      || !isValid(parseISO(customStart)) || !isValid(parseISO(customEnd)) || customStart > customEnd
      || differenceInCalendarDays(parseISO(customEnd), parseISO(customStart)) > 366
    )) {
      return NextResponse.json({ error: "Choose a valid date range of up to 366 days." }, { status: 400 });
    }

    // Timezone-independent queries start right away, in parallel with the tenant lookup.
    const lowStockPromise = Promise.all([
      db.collection("products")
        .find({ tenant_id: tenantId, status: "ACTIVE", minimum_stock: { $gt: 0 } }, { projection: { minimum_stock: 1 } })
        .toArray(),
      db.collection("batches").aggregate([
        { $match: { tenant_id: tenantId, qty_available: { $gt: 0 } } },
        { $group: { _id: "$product_id", stock: { $sum: "$qty_available" } } },
      ]).toArray(),
    ]);
    const inventoryValuePromise = db.collection("batches").aggregate([
      { $match: { tenant_id: tenantId, qty_available: { $gt: 0 } } },
      { $group: { _id: null, value: { $sum: { $multiply: ["$cost_price", "$qty_available"] } } } },
    ]).toArray();

    const tenant = await db.collection("tenants").findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { timezone: 1 } }
    );
    // "Today", chart days and rush hours are all in the store's timezone, not the server's.
    const tz = resolveTimezone(tenant?.timezone);
    const now = new Date();
    const todayStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const zonedStartOf = (dateStr: string) => fromZonedTime(`${dateStr}T00:00:00`, tz);

    // Selected range as inclusive calendar dates in the store's timezone
    let fromStr: string;
    let toStr: string;

    if (dateRange === "custom") {
      fromStr = customStart;
      toStr = customEnd;
    } else {
      const today = parseISO(todayStr);
      switch (dateRange) {
        case "today":
          fromStr = toStr = todayStr;
          break;
        case "yesterday":
          fromStr = toStr = shiftDay(todayStr, -1);
          break;
        case "7days":
          fromStr = shiftDay(todayStr, -6);
          toStr = todayStr;
          break;
        case "thisMonth":
          fromStr = format(startOfMonth(today), "yyyy-MM-dd");
          toStr = format(endOfMonth(today), "yyyy-MM-dd");
          break;
        case "lastMonth":
          fromStr = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
          toStr = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
          break;
        case "30days":
        default:
          fromStr = shiftDay(todayStr, -29);
          toStr = todayStr;
          break;
      }
    }

    const rangeMatch = {
      tenant_id: tenantId,
      created_at: { $gte: zonedStartOf(fromStr), $lt: zonedStartOf(shiftDay(toStr, 1)) },
    };
    const monthStartStr = todayStr.slice(0, 8) + "01";
    const nextMonthStartStr = format(addDays(endOfMonth(parseISO(todayStr)), 1), "yyyy-MM-dd");

    const [
      rangeFacet,
      todaySalesData,
      monthlyProfitData,
      expiringSoonData,
    ] = await Promise.all([
      // One scan of the selected range + one indexed sale_items join feeds every chart.
      db.collection("sales").aggregate([
        { $match: rangeMatch },
        { $project: { total: 1, payment_method: 1, created_at: 1, sid: { $toString: "$_id" } } },
        {
          $lookup: {
            from: "sale_items",
            localField: "sid",
            foreignField: "sale_id",
            pipeline: [{ $project: { _id: 0, product_id: 1, qty: 1, price: 1, discount: 1, profit: 1 } }],
            as: "items",
          },
        },
        {
          $facet: {
            trend: [
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } },
                  revenue: { $sum: "$total" },
                  profit: { $sum: { $sum: "$items.profit" } },
                },
              },
            ],
            payments: [
              { $group: { _id: "$payment_method", revenue: { $sum: "$total" }, count: { $sum: 1 } } },
              { $sort: { revenue: -1 } },
            ],
            hourly: [
              { $group: { _id: { $hour: { date: "$created_at", timezone: tz } }, revenue: { $sum: "$total" } } },
            ],
            products: [
              { $unwind: "$items" },
              {
                $group: {
                  _id: "$items.product_id",
                  qty_sold: { $sum: "$items.qty" },
                  revenue: { $sum: lineRevenueExpr("$items") },
                },
              },
            ],
          },
        },
      ]).toArray(),

      // Today's sales (store timezone) — same definition as the Sales report (invoice total)
      db.collection("sales").aggregate([
        { $match: { tenant_id: tenantId, created_at: { $gte: zonedStartOf(todayStr), $lt: zonedStartOf(shiftDay(todayStr, 1)) } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]).toArray(),

      // This month's profit — same definition as the Profit & Loss report (sum of item profit)
      db.collection("sales").aggregate([
        { $match: { tenant_id: tenantId, created_at: { $gte: zonedStartOf(monthStartStr), $lt: zonedStartOf(nextMonthStartStr) } } },
        { $project: { sid: { $toString: "$_id" } } },
        {
          $lookup: {
            from: "sale_items",
            localField: "sid",
            foreignField: "sale_id",
            pipeline: [{ $project: { _id: 0, profit: 1 } }],
            as: "items",
          },
        },
        { $group: { _id: null, totalProfit: { $sum: { $sum: "$items.profit" } } } },
      ]).toArray(),

      // Batches expiring within 30 days (store timezone)
      db.collection("batches").countDocuments({
        tenant_id: tenantId,
        qty_available: { $gt: 0 },
        expiry_date: { $gte: todayStr, $lte: shiftDay(todayStr, 30) },
      }),
    ]);

    const [[lowStockProducts, stockByProduct], inventoryValueData] = await Promise.all([lowStockPromise, inventoryValuePromise]);

    const { trend, payments, hourly, products: productStats } = rangeFacet[0] ?? { trend: [], payments: [], hourly: [], products: [] };

    // Low stock: active products whose in-stock quantity is below their minimum (incl. products with no stock at all)
    const stockMap = new Map<string, number>(stockByProduct.map((b: any) => [String(b._id), b.stock]));
    const lowStockCount = lowStockProducts.filter((p) => (stockMap.get(p._id.toString()) ?? 0) < p.minimum_stock).length;

    // Resolve product names / categories only for products actually sold in the range
    const productIds = productStats
      .map((p: any) => p._id)
      .filter((id: any) => typeof id === "string" && ObjectId.isValid(id))
      .map((id: string) => new ObjectId(id));
    const productDocs = productIds.length
      ? await db.collection("products")
          .find({ _id: { $in: productIds }, tenant_id: tenantId }, { projection: { name: 1, category_id: 1 } })
          .toArray()
      : [];
    const productMap = new Map(productDocs.map((p) => [p._id.toString(), p]));

    const categoryIds = [...new Set(productDocs.map((p) => p.category_id).filter((id) => typeof id === "string" && ObjectId.isValid(id)))];
    const categoryDocs = categoryIds.length
      ? await db.collection("categories")
          .find({ _id: { $in: categoryIds.map((id) => new ObjectId(id)) } }, { projection: { name: 1 } })
          .toArray()
      : [];
    const categoryMap = new Map(categoryDocs.map((c) => [c._id.toString(), c.name as string]));

    const topProducts = [...productStats]
      .sort((a: any, b: any) => b.qty_sold - a.qty_sold)
      .slice(0, 5)
      .map((p: any) => ({
        _id: p._id,
        name: productMap.get(String(p._id))?.name || "Unknown Medicine",
        qty_sold: p.qty_sold,
        revenue: p.revenue,
      }));

    const categoryTotals = new Map<string, number>();
    for (const p of productStats as any[]) {
      const categoryId = productMap.get(String(p._id))?.category_id;
      const name = (categoryId && categoryMap.get(categoryId)) || "General Health";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + p.revenue);
    }
    const categoryBreakdown = [...categoryTotals]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Daily chart, one point per calendar day in the range
    const trendMap = new Map<string, { revenue: number; profit: number }>(
      trend.map((row: any) => [row._id, { revenue: row.revenue || 0, profit: row.profit || 0 }])
    );
    const chartData = [];
    for (let d = fromStr; d <= toStr; d = shiftDay(d, 1)) {
      chartData.push({ date: d, revenue: trendMap.get(d)?.revenue || 0, profit: trendMap.get(d)?.profit || 0 });
    }

    // Rush hours: 8 AM–10 PM by default, widened so early/late sales aren't dropped
    const hourlyMap = new Map<number, number>(hourly.map((h: any) => [h._id, h.revenue]));
    const soldHours = [...hourlyMap.keys()];
    const firstHour = Math.min(8, ...soldHours);
    const lastHour = Math.max(22, ...soldHours);
    const hourlyTrend = [];
    for (let hour = firstHour; hour <= lastHour; hour++) {
      const label = hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
      hourlyTrend.push({ hour: label, revenue: hourlyMap.get(hour) || 0 });
    }

    return NextResponse.json({
      metrics: {
        todaySales: todaySalesData[0]?.total || 0,
        monthlyProfit: monthlyProfitData[0]?.totalProfit || 0,
        lowStockCount,
        expiringSoonCount: expiringSoonData,
        inventoryValue: inventoryValueData[0]?.value || 0,
      },
      chartData,
      paymentMethods: payments.map((p: any) => ({ method: p._id || "OTHER", revenue: p.revenue, count: p.count })),
      categoryBreakdown,
      hourlyTrend,
      topProducts,
    }, {
      // Must reflect a sale made seconds ago; don't let the browser serve a cached copy.
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/dashboard");
  }
}
