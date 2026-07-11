import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { roleSchema } from "@/lib/validations";
import { checkRole } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    // Only owners/managers can view roles
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

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
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = roleSchema.parse(body);

    const db = client.db("pos");
    
    // Check if role name exists in tenant
    const existing = await db.collection("roles").findOne({ 
      tenant_id: tenantId, 
      name: { $regex: new RegExp(`^${validatedData.name}$`, "i") } 
    });

    if (existing) {
      return NextResponse.json({ error: "Role with this name already exists" }, { status: 400 });
    }

    const newRole = {
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const result = await db.collection("roles").insertOne(newRole);

    return NextResponse.json({ message: "Role created successfully", _id: result.insertedId }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/roles");
  }
}
