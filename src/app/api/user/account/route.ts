import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required to confirm deletion" }, { status: 400 });
    }

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password before deletion
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }

    // If user is OWNER, also mark tenant as DELETED
    if (user.role === "OWNER" && user.tenant_id) {
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
      action: "ERROR" as any, 
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
