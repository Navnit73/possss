import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { getRazorpay } from "@/lib/razorpay";

/** Returns the Razorpay-hosted invoice link for one of this store's payments. */
export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "SETTINGS", "VIEW", { allowLapsed: true });
    if (permError) return permError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const paymentId = new URL(req.url).searchParams.get("payment");
    if (!paymentId) return NextResponse.json({ error: "payment is required" }, { status: 400 });

    // Scoped to the caller's store so one tenant can't fetch another's invoice
    const payment = await client.db("pos").collection("payments").findOne({ tenant_id: tenantId, razorpay_payment_id: paymentId });
    if (!payment?.invoice_id) return NextResponse.json({ error: "No receipt available for this payment." }, { status: 404 });

    const invoice = await getRazorpay().invoices.fetch(payment.invoice_id);
    if (!invoice.short_url) return NextResponse.json({ error: "No receipt available for this payment." }, { status: 404 });

    return NextResponse.json({ url: invoice.short_url });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/billing/receipt");
  }
}
