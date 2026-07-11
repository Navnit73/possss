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
    const payments = await db.collection("payments")
      .find({ tenant_id: tenantId })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json(payments);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/billing");
  }
}
