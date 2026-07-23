import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
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
    const search = url.searchParams.get("search")?.trim() || "";
    const categoryFilter = url.searchParams.get("category") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const batchMatch: any = {
      tenant_id: tenantId,
      qty_available: { $gt: 0 }
    };

    const basePipeline: any[] = [
      { $match: batchMatch },
      {
        $lookup: {
          from: "products",
          let: { prodId: { $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } } },
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
          as: "category_doc"
        }
      },
      { $unwind: { path: "$category_doc", preserveNullAndEmptyArrays: true } }
    ];

    if (categoryFilter) {
      basePipeline.push({
        $match: { "category_doc.name": categoryFilter }
      });
    }

    if (search) {
      const escapedSearch = escapeRegExp(search);
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(escapedSearch, "i") } },
            { batch_number: { $regex: new RegExp(escapedSearch, "i") } }
          ]
        }
      });
    }

    // Facet for Metrics & Charts
    const facetPipeline = [
      ...basePipeline,
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                total_products: { $addToSet: "$product_id" },
                total_stock_qty: { $sum: "$qty_available" },
                purchase_value: { $sum: { $multiply: ["$qty_available", "$cost_price"] } },
                selling_value: { $sum: { $multiply: ["$qty_available", "$selling_price"] } }
              }
            },
            {
              $project: {
                total_products: { $size: "$total_products" },
                total_stock_qty: 1,
                purchase_value: 1,
                selling_value: 1,
                expected_profit: { $subtract: ["$selling_value", "$purchase_value"] }
              }
            }
          ],
          categoryValue: [
            {
              $group: {
                _id: { $ifNull: ["$category_doc.name", "General Health"] },
                cost_value: { $sum: { $multiply: ["$qty_available", "$cost_price"] } },
                selling_value: { $sum: { $multiply: ["$qty_available", "$selling_price"] } }
              }
            },
            { $sort: { cost_value: -1 } }
          ],
          topValuedProducts: [
            {
              $group: {
                _id: "$product_id",
                name: { $first: { $ifNull: ["$product.name", "Unknown Product"] } },
                total_cost_value: { $sum: { $multiply: ["$qty_available", "$cost_price"] } },
                total_qty: { $sum: "$qty_available" }
              }
            },
            { $sort: { total_cost_value: -1 } },
            { $limit: 5 }
          ],
          rackDistribution: [
            {
              $group: {
                _id: { $ifNull: ["$product.rack_number", "Unassigned"] },
                stock_qty: { $sum: "$qty_available" },
                cost_value: { $sum: { $multiply: ["$qty_available", "$cost_price"] } }
              }
            },
            { $sort: { stock_qty: -1 } },
            { $limit: 6 }
          ]
        }
      }
    ];

    const facetResult = await db.collection("batches").aggregate(facetPipeline).toArray();
    const facetData = facetResult[0] || { metrics: [], categoryValue: [], topValuedProducts: [], rackDistribution: [] };

    const metrics = facetData.metrics[0] || { total_products: 0, total_stock_qty: 0, purchase_value: 0, selling_value: 0, expected_profit: 0 };

    const tablePipeline = [
      ...basePipeline,
      {
        $project: {
          product_name: { $ifNull: ["$product.name", "Unknown"] },
          category: { $ifNull: ["$category_doc.name", "-"] },
          rack_location: { $ifNull: ["$product.rack_number", "-"] },
          batch_number: 1,
          qty_available: 1,
          cost_price: 1,
          selling_price: 1,
          expiry_date: 1,
          total_cost_value: { $multiply: ["$qty_available", "$cost_price"] },
          expected_revenue: { $multiply: ["$qty_available", "$selling_price"] }
        }
      },
      { $sort: { total_cost_value: -1 } }
    ];

    let items = [];
    let totalItemsCount = 0;

    if (isExport) {
      items = await db.collection("batches").aggregate(tablePipeline).toArray();
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
        db.collection("batches").aggregate(paginatedPipeline).toArray(),
        db.collection("batches").aggregate(countPipeline).toArray()
      ]);
      items = itemsData;
      totalItemsCount = countData[0]?.total || 0;
    }

    return NextResponse.json({
      metrics,
      charts: {
        categoryValue: facetData.categoryValue.map((c: any) => ({
          name: c._id,
          cost_value: c.cost_value,
          selling_value: c.selling_value
        })),
        topValuedProducts: facetData.topValuedProducts.map((p: any) => ({
          name: p.name,
          value: p.total_cost_value,
          qty: p.total_qty
        })),
        rackDistribution: facetData.rackDistribution.map((r: any) => ({
          rack: r._id,
          qty: r.stock_qty,
          value: r.cost_value
        }))
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
    console.error("Inventory Value Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
