import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { manufacturerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const manufacturers = await db.collection("manufacturers").find({ tenant_id: tenantId }).toArray();
    
    return NextResponse.json(manufacturers);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/manufacturers");
  }
}

export const POST = withAuditLog("CREATE_MANUFACTURER", "PRODUCTS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (body && typeof body.name === "string") body.name = body.name.trim();
    const validatedData = manufacturerSchema.parse(body);

    const db = client.db("pos");
    
    // Check uniqueness
    const escapedName = validatedData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await db.collection("manufacturers").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") } // Case-insensitive check
    });
    
    if (existing) {
      return NextResponse.json({ error: "Manufacturer already exists" }, { status: 400 });
    }

    const newDoc = {
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    };
    const result = await db.collection("manufacturers").insertOne(newDoc);
    audit.setAfter({ _id: result.insertedId, ...newDoc });

    return NextResponse.json({ _id: result.insertedId, message: "Manufacturer created" }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "Manufacturer already exists" }, { status: 409 });
    }
    return await handleApiError(error, "POST /api/manufacturers");
  }
});
