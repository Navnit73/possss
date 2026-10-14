import crypto from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { resetPasswordSchema } from "@/lib/validations";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // Rate limit: 3 requests per hour per IP
    const ip = getClientIp(req);
    if (!(await rateLimit(`reset-pw-${ip}`, 3, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { token, password } = resetPasswordSchema.parse(body);

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const db = client.db("pos");
    // Only the hash is stored. (Never match the raw value too: that would let anyone holding a copy of the
    // stored hash use it directly as a token.)
    const tokenFilter = { resetToken: hashedToken, resetTokenExpiry: { $gt: Date.now() } };
    const user = await db.collection("users").findOne(tokenFilter, { projection: { _id: 1 } });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Consume the token atomically so two concurrent submissions can't both use it
    const consumed = await db.collection("users").updateOne(
      { _id: user._id, ...tokenFilter },
      { 
        $set: { password: hashedPassword, password_changed_at: new Date() },
        $unset: { resetToken: "", resetTokenExpiry: "" }
      }
    );
    if (consumed.modifiedCount === 0) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

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
