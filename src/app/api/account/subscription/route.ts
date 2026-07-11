import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
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
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { plan_name, amount } = body;

    const db = client.db("pos");
    
    // MOCK RAZORPAY INTEGRATION
    // 1. Update tenant plan
    await db.collection("tenants").updateOne(
      { _id: new ObjectId(tenantId) },
      { $set: { subscription_plan: plan_name, status: "ACTIVE", updated_at: new Date() } }
    );

    // 2. Add mock payment to billing history
    const mockPayment = {
      tenant_id: tenantId,
      razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(7),
      amount: amount,
      currency: "USD",
      status: "SUCCESS",
      plan_name,
      created_at: new Date()
    };
    await db.collection("payments").insertOne(mockPayment);

    return NextResponse.json({ message: "Subscription upgraded successfully (Mocked)" });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/account/subscription");
  }
}
