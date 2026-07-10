import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { batchSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    const batches = await db.collection("batches").aggregate([
      { $match: { tenant_id: tenantId } },
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
        $sort: { created_at: -1 }
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
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = batchSchema.parse(body);

    const db = client.db("pos");
    
    // Validate product belongs to tenant
    const product = await db.collection("products").findOne({
      _id: new ObjectId(validatedData.product_id),
      tenant_id: tenantId
    });
    if (!product) {
      return NextResponse.json({ error: "Invalid product selected" }, { status: 400 });
    }

    // Validate supplier belongs to tenant if provided
    if (validatedData.supplier && ObjectId.isValid(validatedData.supplier)) {
      const supplier = await db.collection("suppliers").findOne({
        _id: new ObjectId(validatedData.supplier),
        tenant_id: tenantId
      });
      if (!supplier) {
        return NextResponse.json({ error: "Invalid supplier selected" }, { status: 400 });
      }
    }

    // Check batch number uniqueness for the specific product
    const existing = await db.collection("batches").findOne({
      tenant_id: tenantId,
      product_id: validatedData.product_id,
      batch_number: { $regex: new RegExp(`^${validatedData.batch_number}$`, "i") }
    });
    
    if (existing) {
      return NextResponse.json({ error: "This batch number already exists for this product" }, { status: 400 });
    }

    // Start a logical transaction (using normal ops since we may not have a replica set setup)
    const newBatch = {
      ...validatedData,
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
      notes: "Initial batch receiving",
      created_by: session?.user?.id,
      created_at: new Date()
    };

    await db.collection("stock_movements").insertOne(stockMovement);

    return NextResponse.json({ _id: batchResult.insertedId, message: "Batch added and stock recorded" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/inventory/batches");
  }
}
