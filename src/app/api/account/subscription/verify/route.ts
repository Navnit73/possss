import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";
import { logAuditDirectly } from "@/lib/auditLogger";
import { PAID_STATUSES } from "@/lib/billing";
import { getRazorpay, verifyCheckoutSignature } from "@/lib/razorpay";
import { applySubscriptionEntity, recordPayment } from "@/lib/subscriptions";

const verifySchema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Called by the browser right after Razorpay Checkout succeeds.
 * The signature proves the payment belongs to this subscription; the subscription's real state is then read
 * straight from Razorpay, so nothing the browser sends can activate a store by itself.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER"], { allowLapsed: true });
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId || !ObjectId.isValid(tenantId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = verifySchema.parse(await req.json());

    if (!verifyCheckoutSignature(body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature)) {
      return NextResponse.json({ error: "Payment signature could not be verified." }, { status: 400 });
    }

    const db = client.db("pos");
    const tenant = await db.collection("tenants").findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { subscription: 1, subscription_checkout: 1 } }
    );
    const owns = tenant?.subscription?.id === body.razorpay_subscription_id || tenant?.subscription_checkout?.id === body.razorpay_subscription_id;
    if (!owns) {
      return NextResponse.json({ error: "This subscription does not belong to your store." }, { status: 403 });
    }

    const razorpay = getRazorpay();
    const fetchedAt = new Date();
    const entity = await razorpay.subscriptions.fetch(body.razorpay_subscription_id);
    const result = await applySubscriptionEntity(db, entity as any, fetchedAt);

    // Webhooks may be slow or unreachable (e.g. localhost); record the first payment now. It's idempotent.
    try {
      const payment = await razorpay.payments.fetch(body.razorpay_payment_id);
      if (payment.status === "captured" || payment.status === "authorized") {
        await recordPayment(db, String(tenantId), entity.id, payment as any);
      }
    } catch (err) {
      console.error("Could not fetch payment details for verification:", err);
    }

    const paid = PAID_STATUSES.includes(result.status as any) && result.applied;
    if (paid) {
      await logAuditDirectly({
        tenantId, userId, action: "SUBSCRIPTION_ACTIVATED", module: "BILLING",
        after: { subscription_id: entity.id, status: result.status },
      });
    }

    // 202 = verified but Razorpay hasn't marked it paid yet; the client polls GET /api/account/subscription
    return NextResponse.json({ verified: true, status: result.status, active: paid }, { status: paid ? 200 : 202 });
  } catch (error: any) {
    if (error?.error?.description) {
      return NextResponse.json({ error: `Payment provider error: ${error.error.description}` }, { status: 502 });
    }
    return await handleApiError(error, "POST /api/account/subscription/verify");
  }
}
