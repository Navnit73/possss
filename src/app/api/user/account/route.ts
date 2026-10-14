import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { rateLimit } from "@/lib/rateLimit";
import { getRazorpay, isBillingConfigured } from "@/lib/razorpay";

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Deleting an account is destructive: stop a hijacked session from guessing the password
    if (!(await rateLimit(`delete-account-${userId}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required to confirm deletion" }, { status: 400 });
    }

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password before deletion
    const isValid = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }

    // If user is OWNER, also mark tenant as DELETED
    if (user.role === "OWNER" && user.tenant_id) {
      // Never delete a store that is still being billed: stop the Razorpay subscription first, and abort if that fails.
      const tenant = await db.collection("tenants").findOne(
        { _id: new ObjectId(user.tenant_id) },
        { projection: { subscription: 1, subscription_checkout: 1 } }
      );
      if (isBillingConfigured()) {
        for (const sub of [tenant?.subscription, tenant?.subscription_checkout]) {
          if (!sub?.id || ["cancelled", "completed", "expired"].includes(sub.status)) continue;
          try {
            await getRazorpay().subscriptions.cancel(sub.id, false);
          } catch (err: any) {
            const description = String(err?.error?.description ?? "");
            // Already ended on Razorpay's side is fine; anything else must stop the deletion
            if (!/cancel|complet|expir/i.test(description)) {
              console.error("Could not cancel subscription during account deletion:", err);
              return NextResponse.json(
                { error: "We couldn't cancel your subscription, so your account was not deleted. Please try again or contact support." },
                { status: 502 }
              );
            }
          }
        }
      }

      await db.collection("tenants").updateOne(
        { _id: new ObjectId(user.tenant_id) },
        { 
          $set: { 
            status: "DELETED", 
            deleted_at: new Date(),
            deleted_by: userId
          } 
        }
      );
    }

    // Delete the user record
    await db.collection("users").deleteOne({ _id: new ObjectId(userId) });

    // Log the deletion action using a safe string for action type bypass
    await logAction({
      action: "ACCOUNT_DELETED",
      userId: userId,
      details: { 
        message: "User account deleted",
        role: user.role,
        tenant_id: user.tenant_id
      }
    });

    return NextResponse.json({ message: "Account successfully deleted" }, { status: 200 });
  } catch (error: any) {
    console.error("Account deletion error:", error);
    return await handleApiError(error, "/api/user/account");
  }
}
