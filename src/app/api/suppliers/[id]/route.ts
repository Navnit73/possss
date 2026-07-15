import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { supplierSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = client.db("pos");
    const supplier = await db.collection("suppliers").findOne({ 
      _id: new ObjectId(id),
      tenant_id: tenantId 
    });
    
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/suppliers/[id]");
  }
}

export const PUT = withAuditLog("SUPPLIER_UPDATE", "SUPPLIERS", async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
  audit: AuditContext
) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json();
    const validatedData = supplierSchema.parse(body);

    const db = client.db("pos");
    
    const existing = await db.collection("suppliers").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${validatedData.name}$`, "i") },
      _id: { $ne: new ObjectId(id) }
    });
    
    if (existing) {
      return NextResponse.json({ error: "Another supplier with this name already exists" }, { status: 400 });
    }

    const currentSupplier = await db.collection("suppliers").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!currentSupplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    
    audit.setBefore(currentSupplier);

    const updatedFields = { ...validatedData, updated_at: new Date() };

    const result = await db.collection("suppliers").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: updatedFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    audit.setAfter({ ...currentSupplier, ...updatedFields });

    return NextResponse.json({ message: "Supplier updated" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/suppliers/[id]");
  }
});

export const DELETE = withAuditLog("SUPPLIER_DELETE", "SUPPLIERS", async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
  audit: AuditContext
) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "DELETE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = client.db("pos");
    
    // Check if supplier is used in batches
    const inUse = await db.collection("batches").findOne({
      tenant_id: tenantId,
      supplier_id: id // Assuming we store supplier_id, if we store name then we might need to check differently.
    });

    if (inUse) {
       return NextResponse.json({ error: "Cannot delete supplier as it is linked to inventory batches." }, { status: 400 });
    }

    const currentSupplier = await db.collection("suppliers").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!currentSupplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    
    audit.setBefore(currentSupplier);

    const result = await db.collection("suppliers").deleteOne(
      { _id: new ObjectId(id), tenant_id: tenantId }
    );

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Supplier deleted" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/suppliers/[id]");
  }
});
