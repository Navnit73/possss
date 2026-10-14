import { NextResponse, after } from "next/server";
import crypto from "crypto";
import client from "@/lib/mongodb";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/mail";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // Rate limit: 3 requests per hour per IP
    const ip = getClientIp(req);
    if (!(await rateLimit(`forgot-pw-${ip}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { email } = forgotPasswordSchema.parse({
      email: typeof body?.email === "string" ? body.email.trim().toLowerCase() : body?.email,
    });
    const genericResponse = NextResponse.json({ message: "If an account exists, a reset link has been sent." }, { status: 200 });

    // Per-address limit too, so rotating IPs can't flood one inbox (same response, so it doesn't reveal anything)
    if (!(await rateLimit(`forgot-pw-email-${email}`, 3, 60 * 60 * 1000))) {
      return genericResponse;
    }

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ email }, { projection: { _id: 1 } });

    if (!user) {
      // Don't leak whether user exists or not
      return genericResponse;
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes from now

    // Save hashed token to user document
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { resetToken: hashedToken, resetTokenExpiry } }
    );

    // Send the email (unhashed token) after responding, so response time doesn't reveal which emails are registered
    const userId = user._id.toString();
    after(async () => {
      try {
        await sendPasswordResetEmail(email, resetToken);
      } catch (err) {
        console.error("Failed to send password reset email:", err);
      }
      await logAction({
        action: "PASSWORD_RESET_REQUESTED",
        userId,
        details: { email }
      });
    });

    return genericResponse;
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return await handleApiError(error, "/api/auth/forgot-password");
  }
}
