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

    const basePipeline: any[] = [
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
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } }
    ];

    if (search) {
      const escapedSearch = escapeRegExp(search);
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(escapedSearch, "i") } },
            { "product.generic_name": { $regex: new RegExp(escapedSearch, "i") } }
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

    const globalDiscountPipeline = [
      { $match: saleMatch },
      { $group: { _id: null, total_global_discount: { $sum: "$discount" } } }
    ];

    // Additional Chart Aggregations
    const chartsFacetPipeline = [
      ...basePipeline,
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
        $facet: {
          dailyProfitTrend: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
                    ]
                  }
                },
                cogs: { $sum: { $multiply: ["$items.cost_price", "$items.qty"] } },
                profit: { $sum: { $ifNull: ["$items.profit", 0] } }
              }
            },
            { $sort: { _id: 1 } }
          ],
          categoryProfit: [
            {
              $group: {
                _id: { $ifNull: ["$category_doc.name", "General Health"] },
                profit: { $sum: { $ifNull: ["$items.profit", 0] } },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
                    ]
                  }
                }
              }
            },
            { $sort: { profit: -1 } }
          ],
          topProfitableProducts: [
            {
              $group: {
                _id: "$items.product_id",
                name: { $first: { $ifNull: ["$product.name", "Unknown Medicine"] } },
                profit: { $sum: { $ifNull: ["$items.profit", 0] } },
                revenue: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $subtract: [1, { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }] }
                    ]
                  }
                }
              }
            },
            { $sort: { profit: -1 } },
            { $limit: 5 }
          ],
          discountBreakdown: [
            {
              $group: {
                _id: null,
                item_discounts: {
                  $sum: {
                    $multiply: [
                      { $multiply: ["$items.price", "$items.qty"] },
                      { $divide: [{ $ifNull: ["$items.discount", 0] }, 100] }
                    ]
                  }
                }
              }
            }
          ]
        }
      }
    ];

    const [metricsResult, globalDiscResult, chartsFacetResult] = await Promise.all([
      db.collection("sales").aggregate(metricsPipeline).toArray(),
      db.collection("sales").aggregate(globalDiscountPipeline).toArray(),
      db.collection("sales").aggregate(chartsFacetPipeline).toArray()
    ]);

    const metrics = metricsResult[0] || { gross_revenue: 0, product_cost: 0, discounts_given: 0, gross_profit: 0, margin_pct: 0 };
    const globalDisc = globalDiscResult[0]?.total_global_discount || 0;
    
    metrics.discounts_given += globalDisc;
    metrics.gross_revenue -= globalDisc;
    metrics.gross_profit = metrics.gross_revenue - metrics.product_cost;
    metrics.margin_pct = metrics.gross_revenue > 0 ? (metrics.gross_profit / metrics.gross_revenue) * 100 : 0;

    const facet = chartsFacetResult[0] || { dailyProfitTrend: [], categoryProfit: [], topProfitableProducts: [], discountBreakdown: [] };
    const itemDiscTotal = facet.discountBreakdown[0]?.item_discounts || 0;

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
      charts: {
        dailyProfitTrend: facet.dailyProfitTrend.map((d: any) => ({
          date: d._id,
          revenue: d.revenue,
          cogs: d.cogs,
          profit: d.profit
        })),
        categoryProfit: facet.categoryProfit.map((c: any) => ({
          name: c._id,
          profit: c.profit,
          revenue: c.revenue
        })),
        topProfitableProducts: facet.topProfitableProducts.map((p: any) => ({
          name: p.name,
          profit: p.profit,
          revenue: p.revenue
        })),
        waterfall: [
          { category: 'Gross Revenue', amount: metrics.gross_revenue, fill: '#f59e0b' },
          { category: 'COGS (Stock Cost)', amount: metrics.product_cost, fill: '#ef4444' },
          { category: 'Discounts', amount: metrics.discounts_given, fill: '#f97316' },
          { category: 'Net Profit', amount: metrics.gross_profit, fill: '#10b981' }
        ],
        discountBreakdown: [
          { name: 'Item Discounts', amount: itemDiscTotal },
          { name: 'Global Invoice Discounts', amount: globalDisc }
        ]
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
    console.error("P&L Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
