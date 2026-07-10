import { NextResponse } from "next/server";
import crypto from "crypto";
import client from "@/lib/mongodb";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/mail";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // Rate limit: 3 requests per hour per IP
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    if (!rateLimit(`forgot-pw-${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { email } = forgotPasswordSchema.parse(body);

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ email });

    if (!user) {
      // Don't leak whether user exists or not
      return NextResponse.json({ message: "If an account exists, a reset link has been sent." }, { status: 200 });
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes from now

    // Save token to user document
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { resetToken, resetTokenExpiry } }
    );

    // Send email
    await sendPasswordResetEmail(email, resetToken);

    await logAction({
      action: "PASSWORD_RESET_REQUESTED",
      userId: user._id.toString(),
      details: { email }
    });

    return NextResponse.json({ message: "If an account exists, a reset link has been sent." }, { status: 200 });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return await handleApiError(error, "/api/auth/forgot-password");
  }
}
