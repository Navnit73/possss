import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, addDays, format, differenceInCalendarDays, isValid } from "date-fns";
import { checkRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const url = new URL(req.url);

    // Date Filtering for Sales Metrics
    const dateRange = url.searchParams.get("dateRange") || "today";
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    
    let startDate = new Date();
    let endDate = new Date();
    const now = new Date();

    if (dateRange === "custom" && startDateParam && endDateParam) {
      startDate = startOfDay(parseISO(startDateParam));
      endDate = endOfDay(parseISO(endDateParam));
      if (!isValid(startDate) || !isValid(endDate) || startDate > endDate || differenceInCalendarDays(endDate, startDate) > 366) {
        return NextResponse.json({ error: "Choose a valid date range of up to 366 days." }, { status: 400 });
      }
    } else {
      switch (dateRange) {
        case "today":
          startDate = startOfDay(now);
          endDate = endOfDay(now);
          break;
        case "yesterday":
          startDate = startOfDay(subDays(now, 1));
          endDate = endOfDay(subDays(now, 1));
          break;
        case "7days":
          startDate = startOfDay(subDays(now, 6));
          endDate = endOfDay(now);
          break;
        case "thisMonth":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "lastMonth":
          startDate = startOfMonth(subMonths(now, 1));
          endDate = endOfMonth(subMonths(now, 1));
          break;
        case "30days":
        default:
          startDate = startOfDay(subDays(now, 29));
          endDate = endOfDay(now);
          break;
      }
    }

    const saleMatch = {
      tenant_id: tenantId,
      created_at: { $gte: startDate, $lte: endDate }
    };

    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const todayStr = now.toISOString().split('T')[0];
    const plus30Str = addDays(now, 30).toISOString().split('T')[0];

    // Execute queries concurrently using Promise.all for high performance
    const [
      todaySalesData,
      monthlySalesData,
      lowStockData,
      expiringSoonData,
      inventoryValueData,
      trendSalesData,
      paymentData,
      topProductsData,
      categoryData,
      hourlyData
    ] = await Promise.all([
      // 1. TODAY SALES
      db.collection("sales").aggregate([
        { $match: { tenant_id: tenantId, created_at: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
      ]).toArray(),

      // 2. THIS MONTH PROFIT
      db.collection("sales").aggregate([
        { $match: { tenant_id: tenantId, created_at: { $gte: monthStart, $lte: monthEnd } } },
        {
          $lookup: {
            from: "sale_items",
            let: { saleId: { $toString: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }],
            as: "items"
          }
        },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: { $ifNull: ["$items.profit", 0] } }
          }
        }
      ]).toArray(),

      // 3. LOW STOCK COUNT
      db.collection("products").aggregate([
        { $match: { tenant_id: tenantId, status: "ACTIVE" } },
        {
          $lookup: {
            from: "batches",
            let: { prodId: { $toString: "$_id" } },
            pipeline: [
              { $match: { $expr: { $eq: ["$product_id", "$$prodId"] }, qty_available: { $gt: 0 } } }
            ],
            as: "batches"
          }
        },
        {
          $project: {
            name: 1,
            minimum_stock: 1,
            total_stock: { $sum: "$batches.qty_available" }
          }
        },
        { $match: { $expr: { $lt: ["$total_stock", "$minimum_stock"] } } },
        { $count: "count" }
      ]).toArray(),

      // 4. EXPIRING SOON COUNT (30 Days)
      db.collection("batches").aggregate([
        { 
          $match: { 
            tenant_id: tenantId, 
            qty_available: { $gt: 0 },
            expiry_date: { $lte: plus30Str, $gte: todayStr } 
          } 
        },
        { $count: "count" }
      ]).toArray(),

      // 5. INVENTORY VALUE
      db.collection("batches").aggregate([
        { $match: { tenant_id: tenantId, qty_available: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            value: { $sum: { $multiply: ["$cost_price", "$qty_available"] } }
          }
        }
      ]).toArray(),

      // 6. SALES CHART TREND
      db.collection("sales").aggregate([
        { $match: saleMatch },
        {
          $lookup: {
            from: "sale_items",
            let: { saleId: { $toString: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }],
            as: "items"
          }
        },
        {
          $project: {
            dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            revenue: { $subtract: [{ $ifNull: ["$subtotal", "$total"] }, { $ifNull: ["$discount", 0] }] },
            cost: {
              $sum: {
                $map: {
                  input: "$items",
                  as: "it",
                  in: { $multiply: [{ $ifNull: ["$$it.cost_price", 0] }, { $ifNull: ["$$it.qty", 0] }] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: "$dateStr",
            revenue: { $sum: "$revenue" },
            cost: { $sum: "$cost" }
          }
        }
      ]).toArray(),

      // 7. PAYMENT METHOD BREAKDOWN
      db.collection("sales").aggregate([
        { $match: saleMatch },
        { $group: { _id: "$payment_method", revenue: { $sum: "$total" }, count: { $sum: 1 } } }
      ]).toArray(),

      // 8. TOP PRODUCTS
      db.collection("sales").aggregate([
        { $match: saleMatch },
        {
          $lookup: {
            from: "sale_items",
            let: { saleId: { $toString: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }],
            as: "items"
          }
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            let: { prodId: { $convert: { input: "$items.product_id", to: "objectId", onError: null, onNull: null } } },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$prodId"] } } }],
            as: "product"
          }
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$items.product_id",
            name: { $first: { $ifNull: ["$product.name", "Unknown Medicine"] } },
            qty_sold: { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
          }
        },
        { $sort: { qty_sold: -1 } },
        { $limit: 5 }
      ]).toArray(),

      // 9. CATEGORY BREAKDOWN
      db.collection("sales").aggregate([
        { $match: saleMatch },
        {
          $lookup: {
            from: "sale_items",
            let: { saleId: { $toString: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }],
            as: "items"
          }
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            let: { prodId: { $convert: { input: "$items.product_id", to: "objectId", onError: null, onNull: null } } },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$prodId"] } } }],
            as: "product"
          }
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "product.category_obj_id": { 
              $convert: { input: "$product.category_id", to: "objectId", onError: null, onNull: null } 
            }
          }
        },
        {
          $lookup: {
            from: "categories",
            localField: "product.category_obj_id",
            foreignField: "_id",
            as: "category_doc"
          }
        },
        { $unwind: { path: "$category_doc", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$category_doc.name", "General Health"] },
            revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } }
          }
        },
        { $sort: { revenue: -1 } }
      ]).toArray(),

      // 10. HOURLY RUSH TREND
      db.collection("sales").aggregate([
        { $match: saleMatch },
        {
          $group: {
            _id: { $hour: "$created_at" },
            revenue: { $sum: "$total" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray()
    ]);

    const todaySales = todaySalesData[0]?.total || 0;
    const monthlyProfit = monthlySalesData[0]?.totalProfit || 0;

    const lowStockCount = lowStockData[0]?.count || 0;
    const expiringSoonCount = expiringSoonData[0]?.count || 0;
    const inventoryValue = inventoryValueData[0]?.value || 0;

    // Process Trend Data
    const groupedByDate: Record<string, { revenue: number; profit: number }> = {};
    trendSalesData.forEach((row: any) => {
      const dateStr = row._id;
      if (dateStr) {
        const revenue = Number(row.revenue || 0);
        const cost = Number(row.cost || 0);
        groupedByDate[dateStr] = {
          revenue,
          profit: revenue - cost
        };
      }
    });

    const chartData = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = format(current, "yyyy-MM-dd");
      chartData.push({
        date: dateStr,
        revenue: groupedByDate[dateStr]?.revenue || 0,
        profit: groupedByDate[dateStr]?.profit || 0
      });
      current = addDays(current, 1);
    }

    // Process Hourly Trend
    const hourlyMap: Record<number, number> = {};
    hourlyData.forEach(h => {
      hourlyMap[h._id] = h.revenue;
    });
    const hourlyTrend = Array.from({ length: 15 }, (_, i) => {
      const hour = i + 8; // 8 AM to 10 PM
      const formattedHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? `12 PM` : `${hour} AM`;
      return {
        hour: formattedHour,
        revenue: hourlyMap[hour] || 0
      };
    });

    return NextResponse.json({
      metrics: {
        todaySales,
        monthlyProfit,
        lowStockCount,
        expiringSoonCount,
        inventoryValue
      },
      chartData,
      paymentMethods: paymentData.map(p => ({ method: p._id || "OTHER", revenue: p.revenue, count: p.count })),
      categoryBreakdown: categoryData.map(c => ({ name: c._id, revenue: c.revenue })),
      hourlyTrend,
      topProducts: topProductsData
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=30" }
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch dashboard data" }, { status: 500 });
  }
}
