import crypto from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { resetPasswordSchema } from "@/lib/validations";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const MAX_OTP_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!(await rateLimit(`reset-pw-${ip}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { email, otp, password } = resetPasswordSchema.parse(body);
    const invalid = () => NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

    const db = client.db("pos");
    const users = db.collection("users");
    const user = await users.findOne(
      { email, resetToken: { $exists: true }, resetTokenExpiry: { $gt: Date.now() } },
      { projection: { _id: 1, resetToken: 1, resetTokenAttempts: 1 } }
    );
    if (!user) return invalid();

    // Brute-force protection: a 6-digit code is only safe with a hard attempt cap
    if ((user.resetTokenAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await users.updateOne({ _id: user._id }, { $unset: { resetToken: "", resetTokenExpiry: "", resetTokenAttempts: "" } });
      return invalid();
    }

    const hashedOtp = crypto.createHash("sha256").update(`${email}:${otp}`).digest("hex");
    const a = Buffer.from(hashedOtp);
    const b = Buffer.from(String(user.resetToken));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await users.updateOne({ _id: user._id }, { $inc: { resetTokenAttempts: 1 } });
      return invalid();
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Consume the OTP atomically so two concurrent submissions can't both use it
    const consumed = await users.updateOne(
      { _id: user._id, resetToken: hashedOtp, resetTokenExpiry: { $gt: Date.now() } },
      {
        $set: { password: hashedPassword, password_changed_at: new Date() },
        $unset: { resetToken: "", resetTokenExpiry: "", resetTokenAttempts: "" }
      }
    );
    if (consumed.modifiedCount === 0) return invalid();

    await logAction({
      action: "PASSWORD_RESET_COMPLETED",
      userId: user._id.toString()
    });

    return NextResponse.json({ message: "Password reset successful" }, { status: 200 });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return await handleApiError(error, "/api/auth/reset-password");
  }
}
