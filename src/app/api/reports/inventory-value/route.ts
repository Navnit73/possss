import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db();
    const url = new URL(req.url);

    // Filters
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const batchMatch: any = {
      tenant_id: tenantId,
      qty_available: { $gt: 0 } // Only value current active stock
    };

    // Base pipeline: Batches + Products
    const basePipeline = [
      { $match: batchMatch },
      {
        $lookup: {
          from: "products",
          let: { prodId: { $toObjectId: "$product_id" } },
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
          as: "product.category"
        }
      },
      {
        $unwind: { path: "$product.category", preserveNullAndEmptyArrays: true }
      }
    ];

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(search, "i") } },
            { batch_number: { $regex: new RegExp(search, "i") } }
          ]
        }
      });
    }

    // Metrics Pipeline
    const metricsPipeline = [
      ...basePipeline,
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
    ];

    const metricsResult = await db.collection("batches").aggregate(metricsPipeline).toArray();
    const metrics = metricsResult[0] || { total_products: 0, total_stock_qty: 0, purchase_value: 0, selling_value: 0, expected_profit: 0 };

    // Table Pipeline
    const tablePipeline = [
      ...basePipeline,
      {
        $project: {
          product_name: { $ifNull: ["$product.name", "Unknown"] },
          category: { $ifNull: ["$product.category.name", "-"] },
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
