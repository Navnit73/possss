import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { roleSchema } from "@/lib/validations";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { logAuditDirectly } from "@/lib/auditLogger";
import { headers } from "next/headers";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "ROLES", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const roles = await db.collection("roles").find({ tenant_id: tenantId }).toArray();

    return NextResponse.json(roles);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/roles");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "ROLES", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = roleSchema.parse(body);

    const db = client.db("pos");
    
    // Check if role name exists in tenant
    const existing = await db.collection("roles").findOne({ 
      tenant_id: tenantId, 
      name: { $regex: new RegExp(`^${validatedData.name.trim()}$`, "i") } 
    });

    if (existing) {
      return NextResponse.json({ error: "Role with this name already exists" }, { status: 400 });
    }

    const newRole = {
      ...validatedData,
      name: validatedData.name.trim(),
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const result = await db.collection("roles").insertOne(newRole);

    // Record Audit Log
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "Unknown IP";
    const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";

    await logAuditDirectly({
      tenantId,
      userId,
      action: "ROLE_CREATED",
      module: "ROLES",
      ip,
      browser,
      after: { roleId: result.insertedId.toString(), name: newRole.name, permissionsCount: newRole.permissions?.length || 0 }
    });

    return NextResponse.json({ message: "Role created successfully", _id: result.insertedId }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/roles");
  }
}

