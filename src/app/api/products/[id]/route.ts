import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { logAction } from "@/lib/logger";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");

    const products = await db.collection("products").aggregate([
      { $match: { _id: new ObjectId(id), tenant_id: tenantId } },
      {
        $addFields: {
          category_obj_id: { $toObjectId: "$category_id" },
          manufacturer_obj_id: { $toObjectId: "$manufacturer_id" }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "category_obj_id",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "manufacturer_obj_id",
          foreignField: "_id",
          as: "manufacturer"
        }
      },
      {
        $unwind: { path: "$category", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: "$manufacturer", preserveNullAndEmptyArrays: true }
      }
    ]).toArray();
    
    if (!products.length) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(products[0]);
  } catch (error: any) {
    return await handleApiError(error, `GET /api/products/${id}`);
  }
}

export const PUT = withAuditLog("EDIT_PRODUCT", "PRODUCTS", async (req: Request, { params }: { params: Promise<{ id: string }> }, audit: AuditContext) => {
  const { id } = await params;
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = productSchema.parse(body);

    const db = client.db("pos");
    
    // Validate category belongs to tenant
    const category = await db.collection("categories").findOne({
      _id: new ObjectId(validatedData.category_id),
      tenant_id: tenantId
    });
    if (!category) {
      return NextResponse.json({ error: "Invalid category selected" }, { status: 400 });
    }

    // Validate manufacturer belongs to tenant
    const manufacturer = await db.collection("manufacturers").findOne({
      _id: new ObjectId(validatedData.manufacturer_id),
      tenant_id: tenantId
    });
    if (!manufacturer) {
      return NextResponse.json({ error: "Invalid manufacturer selected" }, { status: 400 });
    }

    // Check barcode uniqueness if changed
    if (validatedData.barcode) {
      const existing = await db.collection("products").findOne({ 
        tenant_id: tenantId, 
        barcode: validatedData.barcode,
        _id: { $ne: new ObjectId(id) }
      });
      if (existing) {
        return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 400 });
      }
    }

    const existingProduct = await db.collection("products").findOne({ _id: new ObjectId(id), tenant_id: tenantId });
    if (!existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    
    audit.setBefore(existingProduct);

    const updatedFields = { ...validatedData, updated_at: new Date() };

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: updatedFields }
    );

    audit.setAfter({ ...existingProduct, ...updatedFields });

    return NextResponse.json({ message: "Product updated successfully" }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, `PUT /api/products/${id}`);
  }
});
