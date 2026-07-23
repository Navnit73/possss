import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { checkPermission } from "@/lib/rbac";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "REPORTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const url = new URL(req.url);

    // Filters
    const dateRange = url.searchParams.get("dateRange") || "30days";
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const search = url.searchParams.get("search")?.trim() || "";
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
      const escapedSearch = escapeRegExp(search);
      saleMatch.$or = [
        { invoice_no: { $regex: new RegExp(escapedSearch, "i") } }
      ];
    }

    // 3. Parallel Aggregations for Sales Metrics & Charts
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
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            method: "$payment_method"
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
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

    // Chart 1: Hourly Sales Rush Breakdown
    const hourlyPipeline = [
      { $match: saleMatch },
      {
        $group: {
          _id: { $hour: "$created_at" },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    // Chart 2: Customer Type Breakdown (Registered vs Walk-in)
    const customerTypePipeline = [
      { $match: saleMatch },
      {
        $group: {
          _id: {
            $cond: [
              { $and: [{ $ne: ["$customer_id", null] }, { $ne: ["$customer_id", ""] }] },
              "Registered Patient",
              "Walk-in Customer"
            ]
          },
          revenue: { $sum: "$total" },
          count: { $sum: 1 }
        }
      }
    ];

    // Chart 3 & 4: Top 5 Products & Sales by Medicine Category
    const itemsAggregationPipeline = [
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
          let: { prodId: { $convert: { input: "$items.product_id", to: "objectId", onError: null, onNull: null } } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$prodId"] } } }
          ],
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
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          topProducts: [
            {
              $group: {
                _id: "$items.product_id",
                product_name: { $first: { $ifNull: ["$product.name", "Unknown Medicine"] } },
                qty_sold: { $sum: "$items.qty" },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
                    ]
                  }
                },
                profit: { $sum: { $ifNull: ["$items.profit", 0] } }
              }
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 }
          ],
          categoryBreakdown: [
            {
              $group: {
                _id: { $ifNull: ["$category.name", "General Health"] },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
                    ]
                  }
                },
                qty: { $sum: "$items.qty" }
              }
            },
            { $sort: { revenue: -1 } }
          ],
          dailyProfitTrend: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                profit: { $sum: { $ifNull: ["$items.profit", 0] } }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ];

    const [
      metricsResult, 
      trendResult, 
      paymentResult,
      hourlyResult,
      customerTypeResult,
      itemsFacetResult
    ] = await Promise.all([
      db.collection("sales").aggregate(salesMetricsPipeline).toArray(),
      db.collection("sales").aggregate(dailyTrendPipeline).toArray(),
      db.collection("sales").aggregate(paymentTrendPipeline).toArray(),
      db.collection("sales").aggregate(hourlyPipeline).toArray(),
      db.collection("sales").aggregate(customerTypePipeline).toArray(),
      db.collection("sales").aggregate(itemsAggregationPipeline).toArray()
    ]);

    const metrics = metricsResult[0] || { total_revenue: 0, total_orders: 0, total_tax: 0, total_discount: 0 };
    const avgOrderValue = metrics.total_orders > 0 ? metrics.total_revenue / metrics.total_orders : 0;
    
    // Process items facet results
    const facet = itemsFacetResult[0] || { topProducts: [], categoryBreakdown: [], dailyProfitTrend: [] };
    const profitMap = new Map<string, number>();
    for (const p of facet.dailyProfitTrend) {
      profitMap.set(p._id, p.profit);
    }

    // Group daily trend by date with payment method breakdowns & net profit
    const trendMap = new Map<string, any>();
    let maxDayRevenue = 0;
    let bestDayDate = "N/A";

    for (const item of trendResult) {
      const date = item._id.date;
      const method = (item._id.method || "OTHER").toString().toUpperCase();
      if (!trendMap.has(date)) {
        trendMap.set(date, { 
          date, 
          revenue: 0, 
          orders: 0, 
          cash: 0, 
          card: 0, 
          upi: 0, 
          other: 0,
          profit: profitMap.get(date) || 0 
        });
      }
      const entry = trendMap.get(date);
      entry.revenue += item.revenue;
      entry.orders += item.orders;

      if (method === "CASH") entry.cash += item.revenue;
      else if (method === "CARD") entry.card += item.revenue;
      else if (method === "UPI") entry.upi += item.revenue;
      else entry.other += item.revenue;

      if (entry.revenue > maxDayRevenue) {
        maxDayRevenue = entry.revenue;
        bestDayDate = date;
      }
    }

    const dailyTrend = Array.from(trendMap.values());

    // Format Hourly Rush Data (0 to 23 hours)
    const hourlyMap = new Map<number, { hour: string; revenue: number; orders: number }>();
    for (let h = 8; h <= 22; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHour = `${h % 12 === 0 ? 12 : h % 12} ${ampm}`;
      hourlyMap.set(h, { hour: formattedHour, revenue: 0, orders: 0 });
    }
    for (const hItem of hourlyResult) {
      const h = hItem._id;
      if (hourlyMap.has(h)) {
        const entry = hourlyMap.get(h)!;
        entry.revenue = hItem.revenue;
        entry.orders = hItem.orders;
      }
    }
    const hourlyTrend = Array.from(hourlyMap.values());

    // 4. Aggregate Sale Items for Table View
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
          let: { prodId: { $convert: { input: "$items.product_id", to: "objectId", onError: null, onNull: null } } },
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
          let: { batchId: { $convert: { input: "$items.batch_id", to: "objectId", onError: null, onNull: null } } },
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
          product_name: { $ifNull: ["$product.name", "Unknown Product"] },
          batch_number: { $ifNull: ["$batch.batch_number", "N/A"] },
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
        bestDay: bestDayDate,
        bestDayRevenue: maxDayRevenue,
      },
      charts: {
        dailyTrend,
        paymentMethods: paymentResult.map((p: any) => ({ method: p._id, revenue: p.revenue, count: p.count })),
        hourlyTrend,
        customerType: customerTypeResult.map((c: any) => ({ name: c._id, revenue: c.revenue, count: c.count })),
        topProducts: facet.topProducts.map((p: any) => ({ name: p.product_name, revenue: p.revenue, qty: p.qty_sold })),
        categoryBreakdown: facet.categoryBreakdown.map((c: any) => ({ name: c._id, revenue: c.revenue, qty: c.qty }))
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
