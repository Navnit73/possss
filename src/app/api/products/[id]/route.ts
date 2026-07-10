import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = productSchema.parse(body);

    const db = client.db("pos");
    
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

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { $set: { ...validatedData, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Product updated successfully" }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, `PUT /api/products/${id}`);
  }
}
