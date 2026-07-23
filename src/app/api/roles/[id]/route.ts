import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { roleSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { logAuditDirectly } from "@/lib/auditLogger";
import { headers } from "next/headers";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "ROLES", "EDIT");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = roleSchema.parse(body);

    const db = client.db("pos");
    
    // Ensure the role belongs to the tenant
    const resolvedParams = await params;
    if (!ObjectId.isValid(resolvedParams.id)) {
      return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
    }
    const roleId = new ObjectId(resolvedParams.id);
    const existing = await db.collection("roles").findOne({ _id: roleId, tenant_id: tenantId });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await db.collection("roles").updateOne(
      { _id: roleId },
      { $set: { ...validatedData, name: validatedData.name.trim(), updated_at: new Date() } }
    );

    // Record Audit Log
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "Unknown IP";
    const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";

    await logAuditDirectly({
      tenantId,
      userId,
      action: "ROLE_UPDATED",
      module: "ROLES",
      ip,
      browser,
      before: { name: existing.name, permissionsCount: existing.permissions?.length || 0 },
      after: { name: validatedData.name, permissionsCount: validatedData.permissions?.length || 0 }
    });

    return NextResponse.json({ message: "Role updated successfully" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/roles/[id]");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "ROLES", "DELETE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const resolvedParams = await params;
    if (!ObjectId.isValid(resolvedParams.id)) {
      return NextResponse.json({ error: "Invalid role ID" }, { status: 400 });
    }
    const roleId = new ObjectId(resolvedParams.id);
    
    // Ensure the role belongs to the tenant
    const existing = await db.collection("roles").findOne({ _id: roleId, tenant_id: tenantId });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if any active users in tenant are assigned to this role (matching string or ObjectId)
    const assignedUsersCount = await db.collection("users").countDocuments({
      tenant_id: tenantId,
      $or: [
        { role_id: roleId.toString() },
        { role_id: roleId }
      ]
    });

    if (assignedUsersCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete role '${existing.name}': assigned to ${assignedUsersCount} active staff user(s). Reassign them first.` 
      }, { status: 400 });
    }

    await db.collection("roles").deleteOne({ _id: roleId });

    // Record Audit Log
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "Unknown IP";
    const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";

    await logAuditDirectly({
      tenantId,
      userId,
      action: "ROLE_DELETED",
      module: "ROLES",
      ip,
      browser,
      before: { roleId: roleId.toString(), name: existing.name }
    });

    return NextResponse.json({ message: "Role deleted successfully" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/roles/[id]");
  }
}

