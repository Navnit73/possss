import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { escapeRegExp } from "@/lib/utils";

const MAX_PAGE = 500;

function intParam(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "AUDIT_LOGS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    // parseInt of a bad value is NaN, which would reach $skip/$limit and fail the query
    const page = Math.min(MAX_PAGE, Math.max(1, intParam(url.searchParams.get("page"), 1)));
    const limit = Math.max(1, Math.min(100, intParam(url.searchParams.get("limit"), 20)));
    const skip = (page - 1) * limit;

    const userFilter = url.searchParams.get("user");
    const actionFilter = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");
    const searchFilter = url.searchParams.get("search");

    const matchQuery: any = { tenant_id: tenantId };
    
    if (userFilter) matchQuery.user_id = userFilter;
    if (actionFilter && actionFilter !== "ALL") {
      // Query-string input: escape it so it can't be used as a regex (ReDoS / invalid pattern → 500)
      matchQuery.action = { $regex: escapeRegExp(actionFilter), $options: "i" };
    }
    if (moduleFilter && moduleFilter !== "ALL") {
      matchQuery.module = moduleFilter;
    }

    const db = client.db("pos");

    if (searchFilter && searchFilter.trim().length > 0) {
      const searchRegex = { $regex: escapeRegExp(searchFilter.trim()), $options: "i" };
      
      // Subquery: find user IDs matching the search term to filter audit logs BEFORE lookup
      const matchingUsers = await db.collection("users").find({
        tenant_id: tenantId,
        $or: [
          { name: searchRegex },
          { email: searchRegex }
        ]
      }, { projection: { _id: 1 } }).limit(200).toArray();

      const matchedUserIds = matchingUsers.map(u => u._id.toString());
      
      // Inject search constraints directly into initial match query
      const orConditions: any[] = [
        { action: searchRegex },
        { module: searchRegex },
        { ip: searchRegex },
        { browser: searchRegex }
      ];
      
      if (matchedUserIds.length > 0) {
        orConditions.push({ user_id: { $in: matchedUserIds } });
      }
      matchQuery.$or = orConditions;
    }

    // Page first, then join users for just the returned rows. The join is tenant-scoped and only exposes
    // display fields (never password hashes or reset tokens).
    const pipeline: any[] = [
      { $match: matchQuery },
      { $sort: { timestamp: -1 } },
      {
        $facet: {
          metadata: [ { $count: "total" } ],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $addFields: {
                user_obj_id: { $convert: { input: "$user_id", to: "objectId", onError: null, onNull: null } }
              }
            },
            {
              $lookup: {
                from: "users",
                let: { uid: "$user_obj_id" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$uid"] }, tenant_id: tenantId } },
                  { $project: { name: 1, email: 1, role: 1, role_id: 1, created_at: 1, updated_at: 1 } }
                ],
                as: "user_info"
              }
            },
            { $unwind: { path: "$user_info", preserveNullAndEmptyArrays: true } },
            { $project: { user_obj_id: 0 } }
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
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/audit-logs");
  }
}
