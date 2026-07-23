import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { batchSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTenantIdQueries(tenantId: string) {
  if (!tenantId) return [tenantId];
  if (ObjectId.isValid(tenantId)) {
    return [tenantId, new ObjectId(tenantId)];
  }
  return [tenantId];
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const tenantIds = getTenantIdQueries(tenantId);
    
    const batches = await db.collection("batches").aggregate([
      { $match: { tenant_id: { $in: tenantIds } } },
      { $sort: { created_at: -1 } },
      {
        $addFields: {
          product_obj_id: { 
            $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } 
          }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "product_obj_id",
          foreignField: "_id",
          as: "product"
        }
      },
      {
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          "product.category_obj_id": { 
            $convert: { input: "$product.category_id", to: "objectId", onError: null, onNull: null } 
          }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "product.category_obj_id",
          foreignField: "_id",
          as: "product.category"
        }
      },
      {
        $unwind: { path: "$product.category", preserveNullAndEmptyArrays: true }
      }
    ]).toArray();
    
    return NextResponse.json(batches);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/batches");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = batchSchema.parse(body);

    const db = client.db("pos");
    const tenantIds = getTenantIdQueries(tenantId);
    
    // Validate product belongs to tenant
    const productQuery: any = { tenant_id: { $in: tenantIds } };
    if (ObjectId.isValid(validatedData.product_id)) {
      productQuery._id = new ObjectId(validatedData.product_id);
    } else {
      productQuery._id = validatedData.product_id;
    }

    const product = await db.collection("products").findOne(productQuery);
    if (!product) {
      return NextResponse.json({ error: "Invalid product selected" }, { status: 400 });
    }

    // Validate supplier belongs to tenant if provided
    let supplierName = validatedData.supplier || "";
    if (validatedData.supplier && ObjectId.isValid(validatedData.supplier)) {
      const supplierDoc = await db.collection("suppliers").findOne({
        _id: new ObjectId(validatedData.supplier),
        tenant_id: { $in: tenantIds }
      });
      if (supplierDoc) {
        supplierName = supplierDoc.name;
      }
    }

    // Check batch number uniqueness for the specific product (safely escaped)
    const escapedBatchNo = escapeRegExp(validatedData.batch_number.trim());
    const existing = await db.collection("batches").findOne({
      tenant_id: { $in: tenantIds },
      product_id: validatedData.product_id,
      batch_number: { $regex: new RegExp(`^${escapedBatchNo}$`, "i") }
    });
    
    if (existing) {
      return NextResponse.json({ error: "This batch number already exists for this product" }, { status: 400 });
    }

    const newBatch = {
      ...validatedData,
      supplier: supplierName,
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const batchResult = await db.collection("batches").insertOne(newBatch);

    // Create the ledger entry for this stock addition
    const stockMovement = {
      tenant_id: tenantId,
      product_id: validatedData.product_id,
      batch_id: batchResult.insertedId.toString(),
      movement_type: "PURCHASE",
      quantity: validatedData.qty_available,
      before_qty: 0,
      after_qty: validatedData.qty_available,
      notes: supplierName ? `Initial batch receiving from ${supplierName}` : "Initial batch receiving",
      created_by: (session?.user as any)?.id || "System",
      created_at: new Date()
    };

    await db.collection("stock_movements").insertOne(stockMovement);

    return NextResponse.json({ _id: batchResult.insertedId, message: "Batch added and stock recorded" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/inventory/batches");
  }
}
