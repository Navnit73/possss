import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { logAuditDirectly } from "@/lib/auditLogger";
import { headers } from "next/headers";

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
    }

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user || !user.password) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword, updated_at: new Date() } }
    );

    // Record Security Audit Log
    const tenantId = user.tenant_id || (session.user as any)?.tenant_id;
    if (tenantId) {
      const headersList = await headers();
      const ip = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "Unknown IP";
      const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";

      await logAuditDirectly({
        tenantId,
        userId,
        action: "PASSWORD_CHANGED",
        module: "SECURITY",
        ip,
        browser,
      });
    }

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/account/security");
  }
}

