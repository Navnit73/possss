import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db();
    const url = new URL(req.url);

    // Filters
    const dateRange = url.searchParams.get("dateRange") || "30days"; // today, yesterday, 7days, 30days, thisMonth, lastMonth, custom
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const search = url.searchParams.get("search") || "";
    const paymentMethod = url.searchParams.get("paymentMethod") || "";
    
    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    
    // Export mode
    const isExport = url.searchParams.get("export") === "true";

    // 1. Determine Date Filter
    let startDate: Date;
    let endDate: Date;
    const now = new Date();

    if (dateRange === "custom" && startDateParam && endDateParam) {
      startDate = startOfDay(parseISO(startDateParam));
      endDate = endOfDay(parseISO(endDateParam));
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

    // 2. Build Match Stage for Sales
    const saleMatch: any = {
      tenant_id: tenantId,
      created_at: { $gte: startDate, $lte: endDate }
    };

    if (paymentMethod) {
      saleMatch.payment_method = paymentMethod;
    }

    if (search) {
      saleMatch.$or = [
        { invoice_no: { $regex: new RegExp(search, "i") } }
      ];
    }

    // 3. Aggregate Sales Metrics & Charts
    const salesMetricsPipeline = [
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          total_revenue: { $sum: "$total" },
          total_orders: { $sum: 1 },
          total_tax: { $sum: "$tax" },
          total_discount: { $sum: "$discount" }
        }
      }
    ];

    const dailyTrendPipeline = [
      { $match: saleMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const paymentTrendPipeline = [
      { $match: saleMatch },
      {
        $group: {
          _id: "$payment_method",
          revenue: { $sum: "$total" },
          count: { $sum: 1 }
        }
      }
    ];

    const [metricsResult, trendResult, paymentResult] = await Promise.all([
      db.collection("sales").aggregate(salesMetricsPipeline).toArray(),
      db.collection("sales").aggregate(dailyTrendPipeline).toArray(),
      db.collection("sales").aggregate(paymentTrendPipeline).toArray()
    ]);

    const metrics = metricsResult[0] || { total_revenue: 0, total_orders: 0, total_tax: 0, total_discount: 0 };
    const avgOrderValue = metrics.total_orders > 0 ? metrics.total_revenue / metrics.total_orders : 0;
    
    // Find best sales day
    let bestDay: any = { _id: "N/A", revenue: 0 };
    for (const day of trendResult) {
      if (day.revenue > bestDay.revenue) bestDay = day;
    }

    // 4. Aggregate Sale Items for Table View
    // We join sale_items with sales to get a flat list of line items
    const itemsPipeline: any[] = [
      { $match: saleMatch },
      {
        $lookup: {
          from: "sale_items",
          let: { saleId: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }
          ],
          as: "items"
        }
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          let: { prodId: { $toObjectId: "$items.product_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$prodId"] } } }
          ],
          as: "product"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "batches",
          let: { batchId: { $toObjectId: "$items.batch_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$batchId"] } } }
          ],
          as: "batch"
        }
      },
      { $unwind: { path: "$batch", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: "$items._id",
          invoice_no: 1,
          created_at: 1,
          payment_method: 1,
          product_name: { $ifNull: ["$product.name", "Unknown"] },
          batch_number: { $ifNull: ["$batch.batch_number", "Unknown"] },
          qty: "$items.qty",
          price: "$items.price",
          item_discount: { $ifNull: ["$items.discount", 0] },
          sale_discount: "$discount",
          sale_tax: "$tax",
          sale_total: "$total",
          profit: "$items.profit"
        }
      },
      { $sort: { created_at: -1 } }
    ];

    let items = [];
    let totalItemsCount = 0;

    if (isExport) {
      items = await db.collection("sales").aggregate(itemsPipeline).toArray();
      // Calculate total quantity sold for export
      totalItemsCount = items.length;
    } else {
      const paginatedPipeline = [
        ...itemsPipeline,
        { $skip: skip },
        { $limit: limit }
      ];
      
      const countPipeline = [
        ...itemsPipeline,
        { $count: "total" }
      ];

      const [itemsData, countData] = await Promise.all([
        db.collection("sales").aggregate(paginatedPipeline).toArray(),
        db.collection("sales").aggregate(countPipeline).toArray()
      ]);
      
      items = itemsData;
      totalItemsCount = countData[0]?.total || 0;
    }
    
    // Get total quantity sold across all items in timeframe
    const qtyPipeline = [
      { $match: saleMatch },
      {
        $lookup: {
          from: "sale_items",
          let: { saleId: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$sale_id", "$$saleId"] } } }
          ],
          as: "items"
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total_qty: { $sum: "$items.qty" }
        }
      }
    ];
    const qtyResult = await db.collection("sales").aggregate(qtyPipeline).toArray();
    const totalQtySold = qtyResult[0]?.total_qty || 0;

    return NextResponse.json({
      metrics: {
        totalRevenue: metrics.total_revenue,
        totalOrders: metrics.total_orders,
        avgOrderValue,
        totalQtySold,
        bestDay: bestDay._id,
        bestDayRevenue: bestDay.revenue,
      },
      charts: {
        dailyTrend: trendResult.map(d => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
        paymentMethods: paymentResult.map(p => ({ method: p._id, revenue: p.revenue, count: p.count }))
      },
      table: {
        data: items,
        pagination: {
          total: totalItemsCount,
          page,
          limit,
          totalPages: Math.ceil(totalItemsCount / limit)
        }
      }
    });

  } catch (error: any) {
    console.error("Sales Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
