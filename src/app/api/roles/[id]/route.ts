import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { roleSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";
import { checkRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = roleSchema.parse(body);

    const db = client.db("pos");
    
    // Ensure the role belongs to the tenant
    const resolvedParams = await params;
    const roleId = new ObjectId(resolvedParams.id);
    const existing = await db.collection("roles").findOne({ _id: roleId, tenant_id: tenantId });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    await db.collection("roles").updateOne(
      { _id: roleId },
      { $set: { ...validatedData, updated_at: new Date() } }
    );

    return NextResponse.json({ message: "Role updated successfully" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/roles/[id]");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const resolvedParams = await params;
    const roleId = new ObjectId(resolvedParams.id);
    
    // Ensure the role belongs to the tenant
    const existing = await db.collection("roles").findOne({ _id: roleId, tenant_id: tenantId });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if any users are assigned to this role
    const assignedUsers = await db.collection("users").countDocuments({ role_id: roleId.toString() });
    if (assignedUsers > 0) {
      return NextResponse.json({ error: "Cannot delete role assigned to active users" }, { status: 400 });
    }

    await db.collection("roles").deleteOne({ _id: roleId });

    return NextResponse.json({ message: "Role deleted successfully" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/roles/[id]");
  }
}
