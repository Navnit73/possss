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
    const dateRange = url.searchParams.get("dateRange") || "30days";
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const search = url.searchParams.get("search") || "";
    
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
        case "today": startDate = startOfDay(now); endDate = endOfDay(now); break;
        case "yesterday": startDate = startOfDay(subDays(now, 1)); endDate = endOfDay(subDays(now, 1)); break;
        case "7days": startDate = startOfDay(subDays(now, 6)); endDate = endOfDay(now); break;
        case "thisMonth": startDate = startOfMonth(now); endDate = endOfMonth(now); break;
        case "lastMonth": startDate = startOfMonth(subMonths(now, 1)); endDate = endOfMonth(subMonths(now, 1)); break;
        case "30days":
        default: startDate = startOfDay(subDays(now, 29)); endDate = endOfDay(now); break;
      }
    }

    const saleMatch: any = {
      tenant_id: tenantId,
      created_at: { $gte: startDate, $lte: endDate }
    };

    // To calculate P&L accurately, we must look at line items
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

    // Apply Product Search filter
    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(search, "i") } },
            { "product.generic_name": { $regex: new RegExp(search, "i") } }
          ]
        }
      });
    }

    // Top Level Metrics Pipeline
    const metricsPipeline = [
      ...basePipeline,
      {
        $group: {
          _id: null,
          gross_revenue: { 
            // Revenue is (price * qty) * (1 - discount/100)
            $sum: {
              $multiply: [
                { $multiply: ["$items.price", "$items.qty"] },
                { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
              ]
            }
          },
          product_cost: {
            $sum: { $multiply: ["$items.cost_price", "$items.qty"] }
          },
          discounts_given: {
            // value of item-level discounts
            $sum: {
              $multiply: [
                { $multiply: ["$items.price", "$items.qty"] },
                { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }
              ]
            }
          }
        }
      },
      {
        $project: {
          gross_revenue: 1,
          product_cost: 1,
          discounts_given: 1,
          gross_profit: { $subtract: ["$gross_revenue", "$product_cost"] },
          margin_pct: {
            $cond: [
              { $gt: ["$gross_revenue", 0] },
              { $multiply: [{ $divide: [{ $subtract: ["$gross_revenue", "$product_cost"] }, "$gross_revenue"] }, 100] },
              0
            ]
          }
        }
      }
    ];

    // Note: To calculate accurate overall discounts, we also need to sum global discounts from `sales`. 
    const globalDiscountPipeline = [
      { $match: saleMatch },
      { $group: { _id: null, total_global_discount: { $sum: "$discount" } } }
    ];

    const [metricsResult, globalDiscResult] = await Promise.all([
      db.collection("sales").aggregate(metricsPipeline).toArray(),
      db.collection("sales").aggregate(globalDiscountPipeline).toArray()
    ]);

    const metrics = metricsResult[0] || { gross_revenue: 0, product_cost: 0, discounts_given: 0, gross_profit: 0, margin_pct: 0 };
    const globalDisc = globalDiscResult[0]?.total_global_discount || 0;
    
    // Adjust metrics for global discounts
    metrics.discounts_given += globalDisc;
    metrics.gross_revenue -= globalDisc;
    metrics.gross_profit = metrics.gross_revenue - metrics.product_cost;
    metrics.margin_pct = metrics.gross_revenue > 0 ? (metrics.gross_profit / metrics.gross_revenue) * 100 : 0;

    // Table Data Pipeline: Group by Product
    const tablePipeline = [
      ...basePipeline,
      {
        $group: {
          _id: "$items.product_id",
          product_name: { $first: "$product.name" },
          category: { $first: "$product.category" },
          qty_sold: { $sum: "$items.qty" },
          total_revenue: {
            $sum: {
              $multiply: [
                { $multiply: ["$items.price", "$items.qty"] },
                { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
              ]
            }
          },
          total_cost: {
            $sum: { $multiply: ["$items.cost_price", "$items.qty"] }
          }
        }
      },
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
              0
            ]
          }
        }
      },
      { $sort: { profit: -1 } }
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

    return NextResponse.json({
      metrics,
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
    console.error("P&L Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
