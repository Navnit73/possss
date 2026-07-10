import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { resetPasswordSchema } from "@/lib/validations";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // Rate limit: 3 requests per hour per IP
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    if (!rateLimit(`reset-pw-${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { token, password } = resetPasswordSchema.parse(body);

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ 
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.collection("users").updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { resetToken: "", resetTokenExpiry: "" }
      }
    );

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
