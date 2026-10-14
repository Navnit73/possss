import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const idMatches = [id];
    if (ObjectId.isValid(id)) {
      idMatches.push(new ObjectId(id) as any);
    }

    const logs = await db.collection("audit_logs")
      .find({
        tenant_id: tenantId,
        // Product edits are audited under PRODUCTS; this lets the {tenant_id, module, timestamp} index serve the query
        module: "PRODUCTS",
        $or: [
          { "after._id": { $in: idMatches } },
          { "before._id": { $in: idMatches } },
          { "details.productId": id }
        ]
      })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
      
    // Fetch user details for each log
    const userIds = [...new Set(logs.map(log => log.user_id || log.userId).filter(Boolean))];
    const validUserObjectIds = userIds.filter(uid => ObjectId.isValid(uid)).map(uid => new ObjectId(uid));
    const users = validUserObjectIds.length > 0
      ? await db.collection("users").find({ _id: { $in: validUserObjectIds } }, { projection: { name: 1, email: 1 } }).toArray()
      : [];
    
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user.name || user.email;
      return acc;
    }, {} as Record<string, string>);
    
    const populatedLogs = logs.map(log => {
      const uId = log.user_id || log.userId;
      return {
        ...log,
        userName: uId ? userMap[uId] || "Staff Member" : "System"
      };
    });

    return NextResponse.json(populatedLogs);
  } catch (error: any) {
    return await handleApiError(error, `GET /api/products/${id}/logs`);
  }
}
