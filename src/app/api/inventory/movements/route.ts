import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";
import { ObjectId } from "mongodb";

function getTenantIdQueries(tenantId: string) {
  if (!tenantId) return [tenantId];
  if (ObjectId.isValid(tenantId)) {
    return [tenantId, new ObjectId(tenantId)];
  }
  return [tenantId];
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

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
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const tenantIds = getTenantIdQueries(tenantId);
    const matchStage: any = { tenant_id: { $in: tenantIds } };

    if (type && type !== "All") {
      matchStage.movement_type = { $regex: new RegExp(`^${type}$`, "i") };
    }

    if (startDateStr || endDateStr) {
      const dateQuery: any = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        if (!isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        if (!isNaN(end.getTime())) dateQuery.$lte = end;
      }
      if (Object.keys(dateQuery).length > 0) {
        matchStage.created_at = dateQuery;
      }
    }

    // High Performance Search Subquery
    if (search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: escapedSearch, $options: "i" };

      // Subquery matching product IDs
      const matchingProducts = await db.collection("products").find(
        { tenant_id: { $in: tenantIds }, name: searchRegex },
        { projection: { _id: 1 } }
      ).toArray();

      // Subquery matching batch IDs
      const matchingBatches = await db.collection("batches").find(
        { tenant_id: { $in: tenantIds }, batch_number: searchRegex },
        { projection: { _id: 1, product_id: 1 } }
      ).toArray();

      const matchedProdStringIds = matchingProducts.map(p => p._id.toString());
      const matchedBatchStringIds = matchingBatches.map(b => b._id.toString());

      const orConditions: any[] = [
        { batch_id: searchRegex },
        { notes: searchRegex }
      ];

      if (matchedProdStringIds.length > 0) {
        orConditions.push({ product_id: { $in: matchedProdStringIds } });
      }
      if (matchedBatchStringIds.length > 0) {
        orConditions.push({ batch_id: { $in: matchedBatchStringIds } });
      }

      matchStage.$or = orConditions;
    }

    // Shared Lookup Pipeline Stages
    const lookupStages = [
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
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          product_obj_id: 0,
          batch_obj_id: 0,
          user_obj_id: 0,
          "user.password": 0
        }
      }
    ];

    let items = [];
    let totalItemsCount = 0;

    if (isExport) {
      const exportPipeline = [
        { $match: matchStage },
        { $sort: { created_at: -1 } },
        ...lookupStages
      ];
      items = await db.collection("stock_movements").aggregate(exportPipeline).toArray();
      totalItemsCount = items.length;
    } else {
      // Perform Count and Early Slicing BEFORE heavy joins for max query speed
      const totalItemsCountResult = await db.collection("stock_movements").countDocuments(matchStage);
      totalItemsCount = totalItemsCountResult;

      const paginatedPipeline = [
        { $match: matchStage },
        { $sort: { created_at: -1 } },
        { $skip: skip },
        { $limit: limit },
        ...lookupStages
      ];

      items = await db.collection("stock_movements").aggregate(paginatedPipeline).toArray();
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
