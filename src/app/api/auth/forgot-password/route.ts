import { NextResponse } from "next/server";
import crypto from "crypto";
import client from "@/lib/mongodb";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/mail";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";

export async function POST(req: Request) {
  try {
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
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

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
