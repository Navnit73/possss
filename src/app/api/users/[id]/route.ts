import { NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { Db, ObjectId } from "mongodb";
import type { Session } from "next-auth";
import { handleApiError } from "@/lib/errorHandler";
import { canGrantPermissions, checkPermission } from "@/lib/rbac";
import { updateUserSchema } from "@/lib/validations";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

/** Non-owners may only manage users whose current role grants nothing beyond their own permissions. */
async function canManageUser(db: Db, session: Session | null, targetUser: Record<string, any>, tenantId: string): Promise<boolean> {
  if ((session?.user as any)?.role === "OWNER") return true;
  if (!targetUser.role_id || !ObjectId.isValid(String(targetUser.role_id))) return true;
  const targetRole = await db.collection("roles").findOne(
    { _id: new ObjectId(String(targetUser.role_id)), tenant_id: tenantId },
    { projection: { permissions: 1 } }
  );
  return canGrantPermissions(session, targetRole?.permissions ?? []);
}

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

    const { name, email, password, role_id } = updateUserSchema.parse(await req.json());

    const db = client.db("pos");
    const targetUser = await db.collection("users").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isOwnerCaller = (session?.user as any)?.role === "OWNER";
    // Without this, anyone with USERS:EDIT could reset the owner's email/password and take over the store.
    if (targetUser.role === "OWNER" && !isOwnerCaller) {
      return NextResponse.json({ error: "Only the store owner can edit the owner account." }, { status: 403 });
    }
    // Resetting the password of a more privileged colleague would let a staff member sign in as them.
    if (!isOwnerCaller && id !== (session?.user as any)?.id && !(await canManageUser(db, session, targetUser, tenantId))) {
      return NextResponse.json({ error: "You can't edit a user who has more permissions than you." }, { status: 403 });
    }

    // Check email uniqueness if email is changed
    if (email !== targetUser.email.toLowerCase()) {
      const emailCheck = await db.collection("users").findOne({ email });
      if (emailCheck) {
        return NextResponse.json({ error: "Another user already exists with this email" }, { status: 400 });
      }
    }

    const updateFields: any = {
      name,
      email,
      updated_at: new Date()
    };

    // Password update if provided
    const newPassword = password?.trim() ?? "";
    if (newPassword.length > 0) {
      // Your own password goes through Account → Security (needs the current password and signs you out cleanly)
      if (id === (session?.user as any)?.id) {
        return NextResponse.json({ error: "Change your own password under Account → Security." }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      updateFields.password = await bcrypt.hash(newPassword, 12);
      updateFields.password_changed_at = new Date();
    }

    // Role update if role_id provided and not editing OWNER
    if (role_id && targetUser.role !== "OWNER" && role_id !== targetUser.role_id) {
      if (id === (session?.user as any)?.id && !isOwnerCaller) {
        return NextResponse.json({ error: "You can't change your own role." }, { status: 403 });
      }
      const role = await db.collection("roles").findOne({ _id: new ObjectId(role_id), tenant_id: tenantId });
      if (!role) {
        return NextResponse.json({ error: "Selected role not found" }, { status: 400 });
      }
      if (!canGrantPermissions(session, role.permissions ?? [])) {
        return NextResponse.json({ error: "You can't assign a role with more permissions than you have." }, { status: 403 });
      }
      updateFields.role_id = role_id;
    }

    audit.setBefore({ userId: id, oldName: targetUser.name, oldEmail: targetUser.email });

    await db.collection("users").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: updateFields, ...(updateFields.password ? { $unset: { resetToken: "", resetTokenExpiry: "" } } : {}) }
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
    if (!(await canManageUser(db, session, targetUser, tenantId))) {
      return NextResponse.json({ error: "You can't delete a user who has more permissions than you." }, { status: 403 });
    }

    audit.setBefore({ userId: id, email: targetUser.email, name: targetUser.name });

    await db.collection("users").deleteOne({ _id: new ObjectId(id), tenant_id: tenantId, role: { $ne: "OWNER" } });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/users/[id]");
  }
});

