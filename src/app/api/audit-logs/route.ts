import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // For now, let's require OWNER or MANAGER to view audit logs.
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const userFilter = url.searchParams.get("user");
    const actionFilter = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");

    const query: any = { tenant_id: tenantId };
    
    if (userFilter) query.user_id = userFilter;
    if (actionFilter) query.action = actionFilter;
    if (moduleFilter) query.module = moduleFilter;

    const db = client.db("pos");
    const logs = await db.collection("audit_logs")
      .aggregate([
        { $match: query },
        { $sort: { timestamp: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $addFields: {
            user_obj_id: { 
              $convert: { input: "$user_id", to: "objectId", onError: null, onNull: null } 
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
          $project: {
            user_obj_id: 0,
            "user_info.password": 0,
            "user_info.tenant_id": 0
          }
        }
      ])
      .toArray();

    const total = await db.collection("audit_logs").countDocuments(query);

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
