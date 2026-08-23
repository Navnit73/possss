import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";

const adjustSchema = z.object({
  batch_id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Batch ID"),
  movement_type: z.enum(["SALE", "DAMAGE", "RETURN", "ADJUSTMENT"]),
  quantity: z.coerce.number().refine(val => val !== 0, "Quantity cannot be zero"),
  notes: z.string().optional(),
});

export const POST = withAuditLog("INVENTORY_ADJUSTMENT", "INVENTORY", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = adjustSchema.parse(body);

    const db = client.db("pos");
    
    let batch: any;
    const executeAdjustment = async (sessionParam?: any) => {
      const filter: any = { _id: new ObjectId(validatedData.batch_id), tenant_id: tenantId };
      if (validatedData.quantity < 0) {
        filter.qty_available = { $gte: -validatedData.quantity };
      }

      const options: any = { returnDocument: "before" };
      if (sessionParam) options.session = sessionParam;

      const beforeDoc: any = await db.collection("batches").findOneAndUpdate(
        filter,
        { 
          $inc: { qty_available: validatedData.quantity }, 
          $set: { updated_at: new Date() } 
        },
        options
      );

      const batchDoc = beforeDoc?.value || beforeDoc;

      if (!batchDoc) {
        throw new Error("Batch not found, does not belong to tenant, or insufficient stock");
      }

      const insertOptions: any = {};
      if (sessionParam) insertOptions.session = sessionParam;

      await db.collection("stock_movements").insertOne({
        tenant_id: tenantId,
        product_id: batchDoc.product_id,
        batch_id: (batchDoc._id || "").toString(),
        movement_type: validatedData.movement_type,
        quantity: validatedData.quantity,
        before_qty: batchDoc.qty_available,
        after_qty: batchDoc.qty_available + validatedData.quantity,
        notes: validatedData.notes || "",
        created_by: session?.user?.id,
        created_at: new Date(),
      }, insertOptions);

      return batchDoc;
    };

    try {
      const dbSession = client.startSession();
      try {
        await dbSession.withTransaction(async () => {
          batch = await executeAdjustment(dbSession);
        });
      } finally {
        await dbSession.endSession();
      }
    } catch (txnError: any) {
      if (
        txnError.message?.includes("Transaction numbers are only allowed") || 
        txnError.message?.includes("replica set") ||
        txnError.message?.includes("standalone")
      ) {
        // Fallback to atomic findOneAndUpdate directly without multi-doc transaction
        batch = await executeAdjustment();
      } else {
        throw txnError;
      }
    }

    audit.setBefore(batch);
    audit.setAfter({ ...batch, qty_available: batch.qty_available + validatedData.quantity });
    return NextResponse.json({ 
      message: "Stock adjusted successfully", 
      after_qty: batch.qty_available + validatedData.quantity 
    }, { status: 200 });
  } catch (error: any) {
    if (error.message?.includes("Batch not found") || error.message?.includes("insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return await handleApiError(error, "POST /api/inventory/adjust");
  }
});
