import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER"]);
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(tenantId) });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Mock returning subscription info
    // In real app, this would query a subscriptions collection or Razorpay directly
    return NextResponse.json({
      plan: tenant.subscription_plan || "Free",
      status: tenant.status || "ACTIVE",
      amount: tenant.subscription_plan === "Professional" ? 49 : tenant.subscription_plan === "Business" ? 99 : 0,
      currency: "USD",
      billing_cycle: "Monthly",
      next_billing_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/subscription");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER"]);
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Payment-plan changes must be created from a verified provider webhook.
    // Never trust a browser-supplied plan or amount as proof of payment.
    return NextResponse.json(
      { error: "Subscription changes require verified payment-provider integration." },
      { status: 501 }
    );
  } catch (error: any) {
    return await handleApiError(error, "POST /api/account/subscription");
  }
}
