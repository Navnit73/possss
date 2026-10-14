import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";
import { logAuditDirectly } from "@/lib/auditLogger";
import { getRazorpay } from "@/lib/razorpay";

const manageSchema = z.object({ action: z.enum(["cancel", "resume"]) });

/** Cancel renewal at the end of the paid period, or undo a scheduled cancellation. */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER"], { allowLapsed: true });
    if (roleError) return roleError;
    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId || !ObjectId.isValid(tenantId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action } = manageSchema.parse(await req.json());

    const tenants = client.db("pos").collection("tenants");
    const tenant = await tenants.findOne({ _id: new ObjectId(tenantId) }, { projection: { subscription: 1 } });
    const sub = tenant?.subscription;
    if (!sub?.id) return NextResponse.json({ error: "No subscription found for this store." }, { status: 404 });

    const razorpay = getRazorpay();

    if (action === "cancel") {
      if (sub.cancel_requested || sub.status === "cancelled") {
        return NextResponse.json({ error: "This subscription is already scheduled to cancel." }, { status: 409 });
      }
      if (!["authenticated", "active", "pending", "paused"].includes(sub.status)) {
        return NextResponse.json({ error: "This subscription can't be cancelled." }, { status: 409 });
      }
      // A subscription that has never been charged has no paid period to run out, so it ends immediately.
      const atCycleEnd = sub.status === "active" || sub.status === "pending";
      await razorpay.subscriptions.cancel(sub.id, atCycleEnd);
      await tenants.updateOne(
        { _id: tenant!._id },
        { $set: atCycleEnd ? { "subscription.cancel_requested": true } : { "subscription.status": "cancelled", "subscription.cancel_requested": false } }
      );
    } else {
      if (!sub.cancel_requested) {
        return NextResponse.json({ error: "There is no scheduled cancellation to undo." }, { status: 409 });
      }
      await razorpay.subscriptions.cancelScheduledChanges(sub.id);
      await tenants.updateOne({ _id: tenant!._id }, { $set: { "subscription.cancel_requested": false } });
    }

    await logAuditDirectly({
      tenantId, userId,
      action: action === "cancel" ? "SUBSCRIPTION_CANCEL_REQUESTED" : "SUBSCRIPTION_CANCEL_UNDONE",
      module: "BILLING",
      after: { subscription_id: sub.id },
    });

    return NextResponse.json({ message: action === "cancel" ? "Subscription will not renew." : "Subscription will continue to renew." });
  } catch (error: any) {
    if (error?.error?.description) {
      return NextResponse.json({ error: `Payment provider error: ${error.error.description}` }, { status: 502 });
    }
    return await handleApiError(error, "POST /api/account/subscription/manage");
  }
}
