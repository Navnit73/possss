import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { checkPermission } from "@/lib/rbac";

const adjustSchema = z.object({
  batch_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Batch ID"),
  movement_type: z.enum(["SALE", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: z.coerce.number().refine(val => val !== 0, "Quantity cannot be zero"),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = adjustSchema.parse(body);

    const db = client.db("pos");
    
    // 1. Fetch current batch
    const batch = await db.collection("batches").findOne({
      _id: new ObjectId(validatedData.batch_id),
      tenant_id: tenantId
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const beforeQty = batch.qty_available;
    let afterQty = beforeQty;

    // Determine math based on movement type
    // If it's a SALE or DAMAGE, typically the quantity sent should be positive to deduct, or negative?
    // Let's assume the user passes a positive number for how many were damaged/sold, and we deduct it.
    // If it's a RETURN, we add it. 
    // If it's an ADJUSTMENT, they might pass positive or negative to represent the raw delta.
    
    // Standardizing: `validatedData.quantity` is the literal math delta.
    // So if SALE, they pass -5. If RETURN, they pass +2. 
    // Wait, the UI might be easier if we just let them specify "I sold 5" and we enforce negative for SALE.
    // Let's enforce the delta approach: the quantity field is the raw delta (+ or -).
    afterQty += validatedData.quantity;

    if (afterQty < 0) {
      return NextResponse.json({ error: `Insufficient stock in this batch. (Current: ${beforeQty})` }, { status: 400 });
    }

    // 2. Update Batch
    await db.collection("batches").updateOne(
      { _id: new ObjectId(validatedData.batch_id) },
      { 
        $set: { 
          qty_available: afterQty,
          updated_at: new Date()
        } 
      }
    );

    // 3. Log Stock Movement
    const stockMovement = {
      tenant_id: tenantId,
      product_id: batch.product_id,
      batch_id: batch._id.toString(),
      movement_type: validatedData.movement_type,
      quantity: validatedData.quantity, // delta
      before_qty: beforeQty,
      after_qty: afterQty,
      notes: validatedData.notes || "",
      created_by: session?.user?.id,
      created_at: new Date()
    };

    await db.collection("stock_movements").insertOne(stockMovement);

    return NextResponse.json({ message: "Stock adjusted successfully", after_qty: afterQty }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/inventory/adjust");
  }
}
