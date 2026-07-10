import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const url = new URL(req.url);

    // Filters
    const search = url.searchParams.get("search") || "";
    const type = url.searchParams.get("type") || "All";
    const startDateStr = url.searchParams.get("startDate");
    const endDateStr = url.searchParams.get("endDate");
    
    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const matchStage: any = { tenant_id: tenantId };

    if (type && type !== "All") {
      matchStage.movement_type = type;
    }

    if (startDateStr && endDateStr) {
      // Set to start of day and end of day
      const start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
      matchStage.created_at = { $gte: start, $lte: end };
    }

    const basePipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          product_obj_id: { $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } },
          batch_obj_id: { $convert: { input: "$batch_id", to: "objectId", onError: null, onNull: null } },
          user_obj_id: { $convert: { input: "$created_by", to: "objectId", onError: null, onNull: null } }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "product_obj_id",
          foreignField: "_id",
          as: "product"
        }
      },
      {
        $lookup: {
          from: "batches",
          localField: "batch_obj_id",
          foreignField: "_id",
          as: "batch"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "user_obj_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$batch", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } }
    ];

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: new RegExp(search, "i") } },
            { "batch.batch_number": { $regex: new RegExp(search, "i") } },
            { batch_id: { $regex: new RegExp(search, "i") } }, // Fallback to batch_id text
            { notes: { $regex: new RegExp(search, "i") } }
          ]
        }
      });
    }

    basePipeline.push({ $sort: { created_at: -1 } });

    let items = [];
    let totalItemsCount = 0;

    if (isExport) {
      items = await db.collection("stock_movements").aggregate(basePipeline).toArray();
      totalItemsCount = items.length;
    } else {
      const paginatedPipeline = [
        ...basePipeline,
        { $skip: skip },
        { $limit: limit }
      ];
      const countPipeline = [
        ...basePipeline,
        { $count: "total" }
      ];

      const [itemsData, countData] = await Promise.all([
        db.collection("stock_movements").aggregate(paginatedPipeline).toArray(),
        db.collection("stock_movements").aggregate(countPipeline).toArray()
      ]);
      items = itemsData;
      totalItemsCount = countData[0]?.total || 0;
    }

    return NextResponse.json({
      data: items,
      pagination: {
        total: totalItemsCount,
        page,
        limit,
        totalPages: Math.ceil(totalItemsCount / limit)
      }
    });

  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/movements");
  }
}
