import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";
import { escapeRegExp } from "@/lib/utils";

const MAX_PAGE = 500;

function intParam(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

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
    const page = Math.min(MAX_PAGE, Math.max(1, intParam(url.searchParams.get("page"), 1)));
    const limit = Math.min(100, Math.max(1, intParam(url.searchParams.get("limit"), 20)));
    const skip = (page - 1) * limit;

    const actionFilter = url.searchParams.get("action");
    const moduleFilter = url.searchParams.get("module");
    const searchFilter = url.searchParams.get("search")?.trim();

    const db = client.db("pos");

    // Filters shared by both log collections
    const filters: Record<string, unknown>[] = [];
    if (actionFilter && actionFilter !== "ALL") {
      // The value comes from the query string: escape it so it can't be used as a regex (ReDoS / invalid pattern → 500)
      filters.push({ action: { $regex: escapeRegExp(actionFilter), $options: "i" } });
    }
    if (moduleFilter && moduleFilter !== "ALL") {
      filters.push({ module: moduleFilter });
    }
    if (searchFilter) {
      const searchRegex = { $regex: escapeRegExp(searchFilter), $options: "i" };
      const matchingUsers = await db.collection("users")
        .find({ tenant_id: tenantId, $or: [{ name: searchRegex }, { email: searchRegex }] }, { projection: { _id: 1 } })
        .limit(200)
        .toArray();
      const matchedUserIds = matchingUsers.map((u) => u._id.toString());

      filters.push({
        $or: [
          { action: searchRegex },
          { module: searchRegex },
          { ip: searchRegex },
          { browser: searchRegex },
          ...(matchedUserIds.length ? [{ user_id: { $in: matchedUserIds } }, { userId: { $in: matchedUserIds } }] : []),
        ],
      });
    }

    // audit_logs rows carry tenant_id, legacy `logs` rows carry tenantId; matching each by its own field lets both use an index.
    const auditMatch = { $and: [{ tenant_id: tenantId }, ...filters] };
    const logsMatch = { $and: [{ tenantId: tenantId }, ...filters] };

    // Each side only ever needs its newest (skip + limit) rows, so sort/limit inside each branch instead of
    // sorting the whole history, and look users up only for the rows actually returned.
    const window = skip + limit;
    const [rows, auditTotal, logsTotal] = await Promise.all([
      db.collection("audit_logs").aggregate([
        { $match: auditMatch },
        { $sort: { timestamp: -1 } },
        { $limit: window },
        {
          $unionWith: {
            coll: "logs",
            pipeline: [{ $match: logsMatch }, { $sort: { timestamp: -1 } }, { $limit: window }],
          },
        },
        { $sort: { timestamp: -1 } },
        { $skip: skip },
        { $limit: limit },
      ], { allowDiskUse: true }).toArray(),
      db.collection("audit_logs").countDocuments(auditMatch),
      db.collection("logs").countDocuments(logsMatch),
    ]);

    const userIds = [...new Set(rows.map((r) => r.user_id ?? r.userId).filter((id): id is string => typeof id === "string" && ObjectId.isValid(id)))];
    const users = userIds.length
      ? await db.collection("users")
          .find({ _id: { $in: userIds.map((id) => new ObjectId(id)) }, tenant_id: tenantId }, { projection: { name: 1, email: 1, role: 1, created_at: 1, updated_at: 1 } })
          .toArray()
      : [];
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const logs = rows.map((row) => {
      const userId = row.user_id ?? row.userId;
      return { ...row, effective_user_id: userId, user_info: userMap.get(userId) };
    });

    const total = auditTotal + logsTotal;
    return NextResponse.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/activity");
  }
}
