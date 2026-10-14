import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { supplierSchema } from "@/lib/validations";
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
    const suppliers = await db.collection("suppliers").find({ tenant_id: tenantId }).sort({ name: 1 }).toArray();
    
    return NextResponse.json(suppliers);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/suppliers");
  }
}

export const POST = withAuditLog("SUPPLIER_CREATE", "SUPPLIERS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    
    // empty email from UI might come as empty string, map to undefined for Zod if we want, 
    // but the schema `.or(z.literal(""))` handles it.
    if (body && typeof body.name === "string") body.name = body.name.trim();
    const validatedData = supplierSchema.parse(body);

    const db = client.db("pos");
    
    const escapedName = validatedData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await db.collection("suppliers").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") }
    });
    
    if (existing) {
      return NextResponse.json({ error: "Supplier with this name already exists" }, { status: 400 });
    }

    const newSupplier = {
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    };
    const result = await db.collection("suppliers").insertOne(newSupplier);
    audit.setAfter({ _id: result.insertedId, ...newSupplier });

    return NextResponse.json({ _id: result.insertedId, message: "Supplier created" }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "Supplier with this name already exists" }, { status: 409 });
    }
    return await handleApiError(error, "POST /api/suppliers");
  }
});
