import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays } from "date-fns";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db();
    const url = new URL(req.url);

    // Filters
    const dateRange = url.searchParams.get("dateRange") || "30days";
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const search = url.searchParams.get("search") || "";
    
    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
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
        case "today": startDate = startOfDay(now); endDate = endOfDay(now); break;
        case "yesterday": startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); break;
        case "7days": startDate = startOfDay(subDays(now, 6)); endDate = endOfDay(now); break;
        case "thisMonth": startDate = startOfMonth(now); endDate = endOfMonth(now); break;
        case "lastMonth": startDate = startOfMonth(subMonths(now, 1)); endDate = endOfMonth(subMonths(now, 1)); break;
        case "30days":
        default: startDate = startOfDay(subDays(now, 29)); endDate = endOfDay(now); break;
      }
    }

    // Number of days in selected period
    let daysInPeriod = differenceInDays(endDate, startDate) + 1;
    if (daysInPeriod <= 0) daysInPeriod = 1;

    const saleMatch: any = {
      tenant_id: tenantId,
      created_at: { $gte: startDate, $lte: endDate }
    };

    const basePipeline = [
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
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }
    ];

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(search, "i") } }
          ]
        }
      });
    }

    // Table Pipeline: Group by Product to get Sales Metrics
    const tablePipeline = [
      ...basePipeline,
      {
        $group: {
          _id: "$items.product_id",
          product_name: { $first: "$product.name" },
          category: { $first: "$product.category" },
          qty_sold: { $sum: "$items.qty" },
          revenue_generated: {
            $sum: {
              $multiply: [
                { $multiply: ["$items.price", "$items.qty"] },
                { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
              ]
            }
          },
          profit_generated: {
            $sum: "$items.profit"
          }
        }
      },
      {
        // Now lookup current total stock from batches
        $lookup: {
          from: "batches",
          let: { prodId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$product_id", "$$prodId"] }, qty_available: { $gt: 0 } } },
            { $group: { _id: null, current_stock: { $sum: "$qty_available" } } }
          ],
          as: "stock"
        }
      },
      {
        $project: {
          product_name: { $ifNull: ["$product_name", "Unknown"] },
          category: 1,
          qty_sold: 1,
          revenue_generated: 1,
          profit_generated: 1,
          current_stock: { $ifNull: [{ $arrayElemAt: ["$stock.current_stock", 0] }, 0] },
          avg_daily_sales: { $divide: ["$qty_sold", daysInPeriod] }
        }
      },
      {
        $project: {
          product_name: 1,
          category: 1,
          qty_sold: 1,
          revenue_generated: 1,
          profit_generated: 1,
          current_stock: 1,
          avg_daily_sales: 1,
          estimated_stock_days: {
            $cond: [
              { $gt: ["$avg_daily_sales", 0] },
              { $divide: ["$current_stock", "$avg_daily_sales"] },
              9999
            ]
          }
        }
      },
      // Fast moving means top qty_sold
      { $sort: { qty_sold: -1 } }
    ];

    let items = [];
    let totalItemsCount = 0;

    if (isExport) {
      items = await db.collection("sales").aggregate(tablePipeline).toArray();
      totalItemsCount = items.length;
    } else {
      const paginatedPipeline = [
        ...tablePipeline,
        { $skip: skip },
        { $limit: limit }
      ];
      const countPipeline = [
        ...tablePipeline,
        { $count: "total" }
      ];

      const [itemsData, countData] = await Promise.all([
        db.collection("sales").aggregate(paginatedPipeline).toArray(),
        db.collection("sales").aggregate(countPipeline).toArray()
      ]);
      items = itemsData;
      totalItemsCount = countData[0]?.total || 0;
    }

    // Generate basic metrics based on the top 100 fast moving to give a summary
    const topPerformers = items.slice(0, 5);
    const topRevenue = items.length > 0 ? items.reduce((acc: number, val: any) => acc + val.revenue_generated, 0) : 0;

    return NextResponse.json({
      metrics: {
        topPerformers: topPerformers.map((p: any) => p.product_name),
        totalAnalyzed: totalItemsCount
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
    console.error("Fast Moving Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
