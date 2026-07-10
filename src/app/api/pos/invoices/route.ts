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
    
    // Fetch all sales, sort by newest first
    const sales = await db.collection("sales").find({ tenant_id: tenantId }).sort({ created_at: -1 }).toArray();
    
    // Optionally fetch sale items for each sale if needed, or wait until invoice detail is requested.
    // Given the UI often just wants a list of invoices, we'll return just the sales here.
    return NextResponse.json(sales);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/invoices");
  }
}
