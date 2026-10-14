import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission, checkRole } from "@/lib/rbac";
import { logAuditDirectly } from "@/lib/auditLogger";
import { rateLimit } from "@/lib/rateLimit";
import { PLAN, isSubscriptionLapsed } from "@/lib/billing";
import { BillingNotConfiguredError, getPlanId, getPublicKeyId, getRazorpay, isBillingConfigured } from "@/lib/razorpay";

const LIVE_STATUSES = ["authenticated", "active", "pending", "paused"];

export async function GET() {
  try {
    const session = await auth();
    const roleError = checkPermission(session, "SETTINGS", "VIEW", { allowLapsed: true });
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId || !ObjectId.isValid(tenantId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenant = await client.db("pos").collection("tenants").findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { subscription: 1, subscription_checkout: 1, status: 1 } }
    );
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const sub = tenant.subscription;
    return NextResponse.json({
      configured: isBillingConfigured(),
      plan: { name: PLAN.name, amount: PLAN.amount / 100, currency: PLAN.currency, interval: PLAN.interval, features: PLAN.features },
      subscription: sub
        ? {
            status: sub.status,
            current_end: sub.current_end ?? null,
            charge_at: sub.charge_at ?? null,
            paid_count: sub.paid_count ?? 0,
            cancel_requested: Boolean(sub.cancel_requested),
          }
        : null,
      lapsed: isSubscriptionLapsed(sub),
      can_manage: (session?.user as any)?.role === "OWNER",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/subscription");
  }
}

/** Starts a checkout: creates (or reuses) the Razorpay subscription the browser will pay for. */
export async function POST() {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER"], { allowLapsed: true });
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId || !ObjectId.isValid(tenantId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await rateLimit(`subscribe-${tenantId}`, 10, 60 * 1000))) {
      return NextResponse.json({ error: "Too many attempts. Please try again in a minute." }, { status: 429 });
    }

    const db = client.db("pos");
    const tenants = db.collection("tenants");
    const tenant = await tenants.findOne({ _id: new ObjectId(tenantId) });
    if (!tenant || !["PENDING", "ACTIVE"].includes(tenant.status)) {
      return NextResponse.json({ error: "This store cannot be subscribed." }, { status: 409 });
    }
    // Onboarding step 2 can't be skipped: paying activates the store, which needs its regional settings.
    if (tenant.status === "PENDING" && !tenant.currency) {
      return NextResponse.json({ error: "Please complete your business details before subscribing." }, { status: 409 });
    }

    const current = tenant.subscription;
    if (current && LIVE_STATUSES.includes(current.status) && !isSubscriptionLapsed(current)) {
      return NextResponse.json({ error: "This store already has an active subscription." }, { status: 409 });
    }
    if (current?.status === "cancelled" && !isSubscriptionLapsed(current)) {
      return NextResponse.json({ error: "Your plan is still active until the current period ends." }, { status: 409 });
    }

    const razorpay = getRazorpay();

    // Re-opening checkout shouldn't leave a trail of unpaid subscriptions behind: reuse one that hasn't been paid yet.
    let subscriptionId: string | null = null;
    if (tenant.subscription_checkout?.id) {
      try {
        const existing = await razorpay.subscriptions.fetch(tenant.subscription_checkout.id);
        if (existing.status === "created") subscriptionId = existing.id;
      } catch {
        // Unknown to Razorpay (e.g. keys changed) — fall through and create a new one
      }
    }

    if (!subscriptionId) {
      const created = await razorpay.subscriptions.create({
        plan_id: await getPlanId(),
        total_count: PLAN.totalCount,
        quantity: 1,
        customer_notify: 1,
        notes: { tenant_id: String(tenantId), user_id: String(userId), business_name: String(tenant.business_name ?? "") },
      });
      subscriptionId = created.id;
      await tenants.updateOne(
        { _id: tenant._id },
        { $set: { subscription_checkout: { id: created.id, created_at: new Date() } } }
      );
    }

    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) }, { projection: { name: 1, email: 1 } });

    await logAuditDirectly({
      tenantId, userId, action: "SUBSCRIPTION_CHECKOUT_STARTED", module: "BILLING",
      after: { subscription_id: subscriptionId },
    });

    return NextResponse.json({
      subscription_id: subscriptionId,
      key_id: getPublicKeyId(),
      business_name: tenant.business_name,
      prefill: { name: user?.name ?? "", email: user?.email ?? "" },
    });
  } catch (error: any) {
    if (error instanceof BillingNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // The Razorpay SDK rejects with { statusCode, error: { description } }
    if (error?.error?.description) {
      return NextResponse.json({ error: `Payment provider error: ${error.error.description}` }, { status: 502 });
    }
    return await handleApiError(error, "POST /api/account/subscription");
  }
}
