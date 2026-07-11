import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const logs = await db.collection("logs")
      .find({ action: "PRODUCT_UPDATED", "details.productId": id, tenantId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
      
    // Optionally fetch user details for each log if we want to show who edited
    const userIds = [...new Set(logs.map(log => log.userId).filter(Boolean))];
    const users = await db.collection("users").find({ _id: { $in: userIds.map(uid => new ObjectId(uid)) } }).toArray();
    
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user.name || user.email;
      return acc;
    }, {} as Record<string, string>);
    
    const populatedLogs = logs.map(log => ({
      ...log,
      userName: log.userId ? userMap[log.userId] || "Unknown User" : "System"
    }));

    return NextResponse.json(populatedLogs);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
