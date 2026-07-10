import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    // Aggregation to join category and manufacturer names
    const products = await db.collection("products").aggregate([
      { $match: { tenant_id: tenantId } },
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
    
    return NextResponse.json(products);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/products");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = productSchema.parse(body);

    const db = client.db("pos");
    
    // Validate barcode uniqueness if provided
    if (validatedData.barcode) {
      const existing = await db.collection("products").findOne({ 
        tenant_id: tenantId, 
        barcode: validatedData.barcode 
      });
      if (existing) {
        return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 400 });
      }
    }

    const result = await db.collection("products").insertOne({
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    });

    return NextResponse.json({ _id: result.insertedId, message: "Product created successfully" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/products");
  }
}
