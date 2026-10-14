import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { ObjectId } from "mongodb";
import { fromZonedTime } from "date-fns-tz";
import { resolveTimezone } from "@/lib/storeTime";

const MOVEMENT_TYPES = ["PURCHASE", "SALE", "DAMAGE", "RETURN", "ADJUSTMENT"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Upper bound on a CSV export so one request can't pull the tenant's entire ledger into memory
const MAX_EXPORT_ROWS = 10000;

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
    const permError = checkPermission(session, "INVENTORY", "VIEW");
    if (permError) return permError;

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
    // parseInt can yield NaN (e.g. ?page=abc) and Math.max(1, NaN) is NaN, which breaks $skip
    const parsedPage = parseInt(url.searchParams.get("page") || "1", 10);
    const parsedLimit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 20;
    const skip = (page - 1) * limit;
    const isExport = url.searchParams.get("export") === "true";

    const tenantIds = getTenantIdQueries(tenantId);
    const matchStage: any = { tenant_id: { $in: tenantIds } };

    if (type && type !== "All") {
      // Whitelist instead of building a regex from user input (regex injection / unindexed scan)
      const normalizedType = type.toUpperCase();
      if (!MOVEMENT_TYPES.includes(normalizedType)) {
        return NextResponse.json({ error: "Invalid movement type" }, { status: 400 });
      }
      matchStage.movement_type = normalizedType;
    }

    if (startDateStr || endDateStr) {
      // Interpret the picked calendar dates in the store's timezone, not the server's
      const tenantDoc = ObjectId.isValid(tenantId)
        ? await db.collection("tenants").findOne({ _id: new ObjectId(tenantId) }, { projection: { timezone: 1 } })
        : null;
      const tz = resolveTimezone(tenantDoc?.timezone);
      const dateQuery: any = {};
      if (startDateStr && DATE_RE.test(startDateStr)) {
        const start = fromZonedTime(`${startDateStr}T00:00:00.000`, tz);
        if (!isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (endDateStr && DATE_RE.test(endDateStr)) {
        const end = fromZonedTime(`${endDateStr}T23:59:59.999`, tz);
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
          pipeline: [{ $project: { name: 1, strength: 1 } }],
          as: "product"
        }
      },
      {
        $lookup: {
          from: "batches",
          localField: "batch_obj_id",
          foreignField: "_id",
          pipeline: [{ $project: { batch_number: 1, expiry_date: 1 } }],
          as: "batch"
        }
      },
      {
        // Only expose the display name/email of the user, never the full user document
        $lookup: {
          from: "users",
          localField: "user_obj_id",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, email: 1 } }],
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
          user_obj_id: 0
        }
      }
    ];

    let items = [];
    let totalItemsCount = 0;
    let truncated = false;

    if (isExport) {
      const exportPipeline = [
        { $match: matchStage },
        { $sort: { created_at: -1 } },
        { $limit: MAX_EXPORT_ROWS },
        ...lookupStages
      ];
      items = await db.collection("stock_movements").aggregate(exportPipeline).toArray();
      totalItemsCount = items.length;
      truncated = items.length >= MAX_EXPORT_ROWS;
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
      },
      ...(isExport ? { truncated, maxExportRows: MAX_EXPORT_ROWS } : {})
    });

  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/movements");
  }
}
