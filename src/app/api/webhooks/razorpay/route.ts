import { NextResponse } from "next/server";
import client from "@/lib/mongodb";
import { logAuditDirectly } from "@/lib/auditLogger";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { applySubscriptionEntity, recordPayment } from "@/lib/subscriptions";

// Razorpay retries any non-2xx response, so only return an error when a retry could actually help.
export async function POST(req: Request) {
  // The signature is computed over the exact bytes sent, so read the raw text, not parsed JSON.
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = client.db("pos");
  const eventId = req.headers.get("x-razorpay-event-id");
  const seen = db.collection<{ _id: string; created_at: Date }>("webhook_events");

  // Razorpay can deliver the same event more than once; the unique _id makes the second delivery a no-op.
  if (eventId) {
    try {
      await seen.insertOne({ _id: eventId, created_at: new Date() });
    } catch (err: any) {
      if (err?.code === 11000) return NextResponse.json({ ok: true, duplicate: true });
      throw err;
    }
  }

  try {
    const name: string = event?.event ?? "";
    const subscription = event?.payload?.subscription?.entity;

    if (name.startsWith("subscription.") && subscription?.id) {
      const result = await applySubscriptionEntity(db, subscription);

      const payment = event?.payload?.payment?.entity;
      if (name === "subscription.charged" && payment?.id && result.tenantId) {
        await recordPayment(db, result.tenantId, subscription.id, payment);
      }

      if (result.tenantId) {
        await logAuditDirectly({
          tenantId: result.tenantId,
          action: `SUBSCRIPTION_${name.replace("subscription.", "").toUpperCase()}`,
          module: "BILLING",
          after: { subscription_id: subscription.id, status: subscription.status, payment_id: payment?.id },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);
    // Let the retry through the duplicate check
    if (eventId) await seen.deleteOne({ _id: eventId }).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
