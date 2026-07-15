import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "AUDIT_LOGS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const userFilter = url.searchParams.get("user");
    const actionFilter = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");
    const searchFilter = url.searchParams.get("search");

    const matchQuery: any = { tenant_id: tenantId };
    
    if (userFilter) matchQuery.user_id = userFilter;
    if (actionFilter) matchQuery.action = actionFilter;
    if (moduleFilter) matchQuery.module = moduleFilter;

    const db = client.db("pos");

    if (searchFilter) {
      const searchRegex = { $regex: searchFilter, $options: "i" };
      
      // Subquery: find user IDs matching the search term to filter audit logs BEFORE lookup
      const matchingUsers = await db.collection("users").find({
        tenant_id: tenantId,
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }, { projection: { _id: 1 } }).toArray();

      const matchedUserIds = matchingUsers.map(u => u._id.toString());
      
      // Inject search constraints directly into initial match query
      matchQuery.$or = [
        { action: searchRegex },
        { module: searchRegex }
      ];
      
      if (matchedUserIds.length > 0) {
        matchQuery.$or.push({ user_id: { $in: matchedUserIds } });
      }
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      { $sort: { timestamp: -1 } },
      {
        $addFields: {
          user_obj_id: { $convert: { input: "$user_id", to: "objectId", onError: null, onNull: null } }
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
      }
    ];

    pipeline.push({
      $facet: {
        metadata: [ { $count: "total" } ],
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
    });

    const result = await db.collection("audit_logs").aggregate(pipeline).toArray();
    
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const logs = result[0].data;

    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/audit-logs");
  }
}
