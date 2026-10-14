import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { categorySchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export const PUT = withAuditLog("EDIT_CATEGORY", "PRODUCTS", async (req: Request, props: { params: Promise<{ id: string }> }, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await props.params;
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 });
    }

    const body = await req.json();
    if (body && typeof body.name === "string") body.name = body.name.trim();
    const validatedData = categorySchema.parse(body);

    const db = client.db("pos");
    
    // Check uniqueness, excluding the current category
    const escapedName = validatedData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await db.collection("categories").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${escapedName}$`, "i") },
      _id: { $ne: new ObjectId(id) }
    });
    
    if (existing) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
    }

    const updatedFields = { ...validatedData, updated_at: new Date() };
    const before = await db.collection("categories").findOneAndUpdate(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: updatedFields },
      { returnDocument: "before" }
    );

    if (!before) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    audit.setBefore(before);
    audit.setAfter({ ...before, ...updatedFields });

    return NextResponse.json({ message: "Category updated" });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "Category with this name already exists" }, { status: 409 });
    }
    return await handleApiError(error, "PUT /api/categories/[id]");
  }
});
