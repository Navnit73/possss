import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { logAction } from "@/lib/logger";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    // Aggregation to join category and manufacturer names
    const products = await db.collection("products").aggregate([
      { $match: { tenant_id: tenantId } },
      {
        $addFields: {
          category_obj_id: { 
            $convert: { input: "$category_id", to: "objectId", onError: null, onNull: null } 
          },
          manufacturer_obj_id: { 
            $convert: { input: "$manufacturer_id", to: "objectId", onError: null, onNull: null } 
          }
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
      },
      {
        $addFields: {
          id_string: { $toString: "$_id" }
        }
      },
      {
        $lookup: {
          from: "batches",
          localField: "id_string",
          foreignField: "product_id",
          as: "batches"
        }
      },
      {
        $addFields: {
          total_stock: { $sum: "$batches.qty_available" }
        }
      },
      {
        $project: {
          batches: 0,
          id_string: 0
        }
      }
    ]).toArray();
    
    return NextResponse.json(products);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/products");
  }
}

export const POST = withAuditLog("CREATE_PRODUCT", "PRODUCTS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "CREATE");
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

    const newProduct = {
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const result = await db.collection("products").insertOne(newProduct);

    audit.setAfter({ _id: result.insertedId, ...newProduct });

    return NextResponse.json({ _id: result.insertedId, message: "Product created successfully" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/products");
  }
});
