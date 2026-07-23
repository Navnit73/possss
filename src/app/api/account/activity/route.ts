import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "SETTINGS", action: "VIEW" },
      { module: "AUDIT_LOGS", action: "VIEW" }
    ]);
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const actionFilter = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");
    const searchFilter = url.searchParams.get("search");

    const baseTenantCondition = {
      $or: [{ tenant_id: tenantId }, { tenantId: tenantId }]
    };

    const matchConditions: any[] = [baseTenantCondition];

    if (actionFilter && actionFilter !== "ALL") {
      matchConditions.push({ action: { $regex: actionFilter, $options: "i" } });
    }
    if (moduleFilter && moduleFilter !== "ALL") {
      matchConditions.push({ module: moduleFilter });
    }

    const db = client.db("pos");

    if (searchFilter && searchFilter.trim().length > 0) {
      const escapedSearch = searchFilter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = { $regex: escapedSearch, $options: "i" };

      const matchingUsers = await db.collection("users").find({
        tenant_id: tenantId,
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }, { projection: { _id: 1 } }).toArray();

      const matchedUserIds = matchingUsers.map(u => u._id.toString());

      const searchOrConditions: any[] = [
        { action: searchRegex },
        { module: searchRegex },
        { ip: searchRegex },
        { browser: searchRegex }
      ];

      if (matchedUserIds.length > 0) {
        searchOrConditions.push({ user_id: { $in: matchedUserIds } });
        searchOrConditions.push({ userId: { $in: matchedUserIds } });
      }
      matchConditions.push({ $or: searchOrConditions });
    }

    const finalMatch = matchConditions.length === 1 ? matchConditions[0] : { $and: matchConditions };

    const pipeline: any[] = [
      { $match: finalMatch },
      {
        $unionWith: {
          coll: "logs",
          pipeline: [{ $match: finalMatch }]
        }
      },
      { $sort: { timestamp: -1 } },
      {
        $addFields: {
          effective_user_id: { $ifNull: ["$user_id", "$userId"] }
        }
      },
      {
        $addFields: {
          user_obj_id: {
            $convert: { input: "$effective_user_id", to: "objectId", onError: null, onNull: null }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "user_obj_id",
          foreignField: "_id",
          as: "user_info"
        }
      },
      {
        $unwind: { path: "$user_info", preserveNullAndEmptyArrays: true }
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                user_obj_id: 0,
                "user_info.password": 0,
                "user_info.tenant_id": 0
              }
            }
          ]
        }
      }
    ];

    const result = await db.collection("audit_logs").aggregate(pipeline).toArray();

    const total = result[0]?.metadata[0]?.total || 0;
    const logs = result[0]?.data || [];

    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/activity");
  }
}

