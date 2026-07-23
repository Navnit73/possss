import { NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export const PUT = withAuditLog("STAFF_USER_UPDATED", "USERS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const params = await context.params;
    const { id } = params;

    const session = await auth();
    const permError = checkPermission(session, "USERS", "EDIT");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, email, password, role_id } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const db = client.db("pos");
    const targetUser = await db.collection("users").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check email uniqueness if email is changed
    if (email.toLowerCase().trim() !== targetUser.email.toLowerCase()) {
      const emailCheck = await db.collection("users").findOne({ email: email.toLowerCase().trim() });
      if (emailCheck) {
        return NextResponse.json({ error: "Another user already exists with this email" }, { status: 400 });
      }
    }

    const updateFields: any = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      updated_at: new Date()
    };

    // Password update if provided
    if (password && password.trim().length >= 8) {
      updateFields.password = await bcrypt.hash(password.trim(), 12);
    } else if (password && password.trim().length > 0 && password.trim().length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Role update if role_id provided and not editing OWNER
    if (role_id && targetUser.role !== "OWNER") {
      if (!ObjectId.isValid(role_id)) {
        return NextResponse.json({ error: "Invalid role selected" }, { status: 400 });
      }
      const role = await db.collection("roles").findOne({ _id: new ObjectId(role_id), tenant_id: tenantId });
      if (!role) {
        return NextResponse.json({ error: "Selected role not found" }, { status: 400 });
      }
      updateFields.role_id = role_id;
    }

    audit.setBefore({ userId: id, oldName: targetUser.name, oldEmail: targetUser.email });

    await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    audit.setAfter({ userId: id, newName: updateFields.name, newEmail: updateFields.email });

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/users/[id]");
  }
});

export const DELETE = withAuditLog("STAFF_USER_DELETED", "USERS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const params = await context.params;
    const { id } = params;

    const session = await auth();
    const permError = checkPermission(session, "USERS", "DELETE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    const currentUserId = (session?.user as any)?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (id === currentUserId) {
      return NextResponse.json({ error: "You cannot delete your own user account" }, { status: 400 });
    }

    const db = client.db("pos");
    const targetUser = await db.collection("users").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "OWNER") {
      return NextResponse.json({ error: "Primary store owner cannot be deleted" }, { status: 400 });
    }

    audit.setBefore({ userId: id, email: targetUser.email, name: targetUser.name });

    await db.collection("users").deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/users/[id]");
  }
});

