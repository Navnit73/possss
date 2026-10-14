import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await auth();
    // Payment history is billing data: same permission as the Subscription page, and reachable while locked out
    const permError = checkPermission(session, "SETTINGS", "VIEW", { allowLapsed: true });
    if (permError) return permError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payments = await client.db("pos").collection("payments")
      .find({ tenant_id: tenantId }, { projection: { tenant_id: 0 } })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json(
      payments.map((p) => ({
        _id: p._id.toString(),
        payment_id: p.razorpay_payment_id ?? null,
        plan_name: p.plan_name ?? "Pro",
        amount: p.amount,
        currency: p.currency ?? "USD",
        status: p.status,
        created_at: p.created_at,
        has_receipt: Boolean(p.invoice_id),
      })),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/billing");
  }
}
