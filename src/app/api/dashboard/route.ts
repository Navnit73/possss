import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, addDays } from "date-fns";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db();
    const url = new URL(req.url);

    // Date Filtering for Sales Metrics
    const dateRange = url.searchParams.get("dateRange") || "30days";
    let startDate = new Date();
    let endDate = new Date();
    const now = new Date();

    if (dateRange === "custom") {
      const start = url.searchParams.get("startDate");
      const end = url.searchParams.get("endDate");
      if (start && end) {
        startDate = startOfDay(parseISO(start));
        endDate = endOfDay(parseISO(end));
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

    // 1. TODAY SALES
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const todaySalesData = await db.collection("sales").aggregate([
      { $match: { tenant_id: tenantId, created_at: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]).toArray();
    const todaySales = todaySalesData[0]?.total || 0;

    // 2. THIS MONTH PROFIT
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const monthlyProfitData = await db.collection("sales").aggregate([
      { $match: { tenant_id: tenantId, created_at: { $gte: monthStart, $lte: monthEnd } } },
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
        $group: {
          _id: null,
          profit: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.price", "$items.qty"] },
                { $multiply: ["$items.cost_price", "$items.qty"] }
              ]
            }
          }
        }
      }
    ]).toArray();
    const monthlyProfit = monthlyProfitData[0]?.profit || 0;

    // 3. INVENTORY ALERTS (Low Stock)
    const lowStockData = await db.collection("products").aggregate([
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
    ]).toArray();
    const lowStockCount = lowStockData[0]?.count || 0;

    // 4. EXPIRING SOON ALERTS
    const todayStr = now.toISOString().split('T')[0];
    const plus30Str = addDays(now, 30).toISOString().split('T')[0];
    const expiringSoonData = await db.collection("batches").aggregate([
      { 
        $match: { 
          tenant_id: tenantId, 
          qty_available: { $gt: 0 },
          expiry_date: { $lte: plus30Str, $gte: todayStr } 
        } 
      },
      { $count: "count" }
    ]).toArray();
    const expiringSoonCount = expiringSoonData[0]?.count || 0;

    // 5. INVENTORY VALUE
    const inventoryValueData = await db.collection("batches").aggregate([
      { $match: { tenant_id: tenantId, qty_available: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          value: { $sum: { $multiply: ["$cost_price", "$qty_available"] } }
        }
      }
    ]).toArray();
    const inventoryValue = inventoryValueData[0]?.value || 0;

    // 6. SALES CHART TREND (Based on date range filter)
    const trendResult = await db.collection("sales").aggregate([
      { $match: { tenant_id: tenantId, created_at: { $gte: startDate, $lte: endDate } } },
      {
        $lookup: {
          from: "sale_items",
          let: { saleId: { $toString: "$_id" } },
          pipeline: [{ $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }],
          as: "items"
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          revenue: { $sum: "$total" },
          cost: { $sum: { $sum: { $map: { input: "$items", as: "i", in: { $multiply: ["$$i.cost_price", "$$i.qty"] } } } } }
        }
      },
      {
        $project: {
          date: "$_id",
          revenue: 1,
          profit: { $subtract: ["$revenue", "$cost"] }
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();

    // Fill missing dates
    const chartData = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const match = trendResult.find((d: any) => d.date === dateStr);
      chartData.push({
        date: dateStr,
        revenue: match ? match.revenue : 0,
        profit: match ? match.profit : 0
      });
      current.setDate(current.getDate() + 1);
    }

    // 7. TOP PRODUCTS LEADERBOARD (Based on date range)
    const topProducts = await db.collection("sale_items").aggregate([
      {
        $lookup: {
          from: "sales",
          let: { saleId: { $toObjectId: "$sale_id" } },
          pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$saleId"] }, tenant_id: tenantId, created_at: { $gte: startDate, $lte: endDate } } }],
          as: "sale"
        }
      },
      { $unwind: "$sale" }, // only keep items that joined with a valid sale in range
      {
        $group: {
          _id: "$product_id",
          qty_sold: { $sum: "$qty" },
          revenue: { $sum: { $multiply: ["$price", "$qty"] } }
        }
      },
      { $sort: { qty_sold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          let: { prodId: { $toObjectId: "$_id" } },
          pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$prodId"] } } }],
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: 1,
          name: "$product.name",
          category: "$product.category_id", // Optional: join category if needed, skipping for brevity
          qty_sold: 1,
          revenue: 1
        }
      }
    ]).toArray();

    return NextResponse.json({
      metrics: {
        todaySales,
        monthlyProfit,
        lowStockCount,
        expiringSoonCount,
        inventoryValue
      },
      chartData,
      topProducts
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
