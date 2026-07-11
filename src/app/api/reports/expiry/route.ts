import { NextRequest, NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { addDays, parseISO } from "date-fns";
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
    const filterStatus = url.searchParams.get("status") || "all"; // all, expired, 30days, 60days, 90days
    
    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const todayStr = new Date().toISOString().split('T')[0];
    const plus30Str = addDays(new Date(), 30).toISOString().split('T')[0];
    const plus60Str = addDays(new Date(), 60).toISOString().split('T')[0];
    const plus90Str = addDays(new Date(), 90).toISOString().split('T')[0];

    const batchMatch: any = {
      tenant_id: tenantId,
      qty_available: { $gt: 0 },
      expiry_date: { $exists: true, $ne: "" }
    };

    if (filterStatus === "expired") {
      batchMatch.expiry_date = { $lt: todayStr };
    } else if (filterStatus === "30days") {
      batchMatch.expiry_date = { $gte: todayStr, $lte: plus30Str };
    } else if (filterStatus === "60days") {
      batchMatch.expiry_date = { $gt: plus30Str, $lte: plus60Str };
    } else if (filterStatus === "90days") {
      batchMatch.expiry_date = { $gt: plus60Str, $lte: plus90Str };
    } else {
      // all at-risk (expired + up to 90 days)
      batchMatch.expiry_date = { $lte: plus90Str };
    }

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
        $lookup: {
          from: "suppliers",
          let: { suppId: { $toObjectId: "$supplier_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$suppId"] } } }
          ],
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } }
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

    // Metrics Pipeline - Count for all risk categories (ignore the filterStatus for global metrics)
    const metricsPipeline = [
      { 
        $match: {
          tenant_id: tenantId,
          qty_available: { $gt: 0 },
          expiry_date: { $exists: true, $ne: "", $lte: plus90Str }
        }
      },
      {
        $group: {
          _id: null,
          expired_count: { $sum: { $cond: [{ $lt: ["$expiry_date", todayStr] }, 1, 0] } },
          expired_value: { $sum: { $cond: [{ $lt: ["$expiry_date", todayStr] }, { $multiply: ["$qty_available", "$cost_price"] }, 0] } },
          days30_count: { $sum: { $cond: [{ $and: [{ $gte: ["$expiry_date", todayStr] }, { $lte: ["$expiry_date", plus30Str] }] }, 1, 0] } },
          days60_count: { $sum: { $cond: [{ $and: [{ $gt: ["$expiry_date", plus30Str] }, { $lte: ["$expiry_date", plus60Str] }] }, 1, 0] } },
          days90_count: { $sum: { $cond: [{ $and: [{ $gt: ["$expiry_date", plus60Str] }, { $lte: ["$expiry_date", plus90Str] }] }, 1, 0] } }
        }
      }
    ];

    const metricsResult = await db.collection("batches").aggregate(metricsPipeline).toArray();
    const metrics = metricsResult[0] || { expired_count: 0, expired_value: 0, days30_count: 0, days60_count: 0, days90_count: 0 };

    // Table Pipeline
    const tablePipeline = [
      ...basePipeline,
      {
        $project: {
          product_name: { $ifNull: ["$product.name", "Unknown"] },
          batch_number: 1,
          qty_available: 1,
          expiry_date: 1,
          cost_price: 1,
          supplier_name: { $ifNull: ["$supplier.name", "-"] },
          purchase_value_loss: { $multiply: ["$qty_available", "$cost_price"] },
          status: {
            $cond: [
              { $lt: ["$expiry_date", todayStr] }, "Expired",
              { $cond: [
                { $lte: ["$expiry_date", plus30Str] }, "30 Days",
                { $cond: [
                  { $lte: ["$expiry_date", plus60Str] }, "60 Days",
                  "90 Days"
                ]}
              ]}
            ]
          }
        }
      },
      { $sort: { expiry_date: 1 } }
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
    console.error("Expiry Report API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
