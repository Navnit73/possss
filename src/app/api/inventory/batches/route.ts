import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { batchSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { checkPermission } from "@/lib/rbac";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { getStoreToday } from "@/lib/storeTime";

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

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const MAX_BATCHES_LIMIT = 10000;

// Receiving stock: stricter than the shared batchSchema. A zero-quantity receipt is meaningless and a
// batch with a zero selling price can't be billed at POS.
const receiveBatchSchema = batchSchema.extend({
  batch_number: z.string().trim().min(1, "Batch number is required").max(64, "Batch number is too long"),
  qty_available: z.coerce.number().finite().positive("Quantity received must be greater than zero").max(1_000_000, "Quantity is too large"),
  cost_price: z.coerce.number().finite().min(0, "Cost price cannot be negative").default(0),
  selling_price: z.coerce.number().finite().positive("Selling price must be greater than zero"),
  expiry_date: z.string().trim().optional().refine(
    v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Expiry date must be in YYYY-MM-DD format"
  ),
});

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const tenantIds = getTenantIdQueries(tenantId);
    const url = new URL(req.url);

    // Optional filters (all existing callers send none and get the full list, as before)
    const match: any = { tenant_id: { $in: tenantIds } };
    const productIdParam = url.searchParams.get("product_id");
    if (productIdParam) {
      if (!OBJECT_ID_RE.test(productIdParam)) {
        return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
      }
      match.product_id = productIdParam;
    }
    if (url.searchParams.get("in_stock") === "true") {
      match.qty_available = { $gt: 0 };
    }
    const parsedLimit = parseInt(url.searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_BATCHES_LIMIT)
      : MAX_BATCHES_LIMIT;

    const batches = await db.collection("batches").aggregate([
      { $match: match },
      { $sort: { created_at: -1 } },
      // Hard ceiling so a large tenant can't pull an unbounded result set into memory.
      { $limit: limit },
      {
        $addFields: {
          product_obj_id: { 
            $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } 
          }
        }
      },
      {
        // Only the product fields the stock screens actually render
        $lookup: {
          from: "products",
          localField: "product_obj_id",
          foreignField: "_id",
          pipeline: [
            { $project: { name: 1, strength: 1, minimum_stock: 1, rack_number: 1, category_id: 1, status: 1 } }
          ],
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
          pipeline: [{ $project: { name: 1 } }],
          as: "product.category"
        }
      },
      {
        $unwind: { path: "$product.category", preserveNullAndEmptyArrays: true }
      },
      { $project: { product_obj_id: 0, "product.category_obj_id": 0 } }
    ]).toArray();
    
    return NextResponse.json(batches);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/batches");
  }
}

export const POST = withAuditLog("ADD_STOCK_BATCH", "INVENTORY", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = receiveBatchSchema.parse(body);

    const db = client.db("pos");
    const tenantIds = getTenantIdQueries(tenantId);
    
    // Validate product belongs to tenant (schema guarantees a 24-hex id)
    const product = await db.collection("products").findOne(
      { _id: new ObjectId(validatedData.product_id), tenant_id: { $in: tenantIds } },
      { projection: { _id: 1, name: 1 } }
    );
    if (!product) {
      return NextResponse.json({ error: "Invalid product selected" }, { status: 400 });
    }

    // Receiving stock that has already expired can never be sold — reject it up front.
    if (validatedData.expiry_date) {
      const today = await getStoreToday(db, tenantId);
      if (validatedData.expiry_date < today) {
        return NextResponse.json({ error: "Expiry date is in the past. Expired stock cannot be received." }, { status: 400 });
      }
    }

    // Resolve the supplier. The UI sends the supplier id; older clients sent the name.
    let supplierName = "";
    let supplierId: string | undefined;
    const supplierInput = validatedData.supplier?.trim();
    if (supplierInput) {
      const supplierDoc = await db.collection("suppliers").findOne(
        OBJECT_ID_RE.test(supplierInput)
          ? { _id: new ObjectId(supplierInput), tenant_id: { $in: tenantIds } }
          : { tenant_id: { $in: tenantIds }, name: { $regex: new RegExp(`^${escapeRegExp(supplierInput)}$`, "i") } },
        { projection: { _id: 1, name: 1 } }
      );
      if (!supplierDoc && OBJECT_ID_RE.test(supplierInput)) {
        return NextResponse.json({ error: "Invalid supplier selected" }, { status: 400 });
      }
      if (!supplierDoc) {
        // Free-text supplier from an older client: keep the name as before, just without a link
        supplierName = supplierInput;
      } else {
        supplierName = supplierDoc.name;
        supplierId = supplierDoc._id.toString();
      }
    }

    // Friendly, case-insensitive pre-check. The unique index {tenant_id, product_id, batch_number}
    // is the real guard against concurrent inserts (mapped to 409 below).
    const batchNumber = validatedData.batch_number;
    const existing = await db.collection("batches").findOne({
      tenant_id: { $in: tenantIds },
      product_id: validatedData.product_id,
      batch_number: { $regex: new RegExp(`^${escapeRegExp(batchNumber)}$`, "i") }
    }, { projection: { _id: 1 } });
    
    if (existing) {
      return NextResponse.json({ error: "This batch number already exists for this product" }, { status: 409 });
    }

    const now = new Date();
    const newBatch: any = {
      product_id: validatedData.product_id,
      batch_number: batchNumber,
      supplier: supplierName,
      ...(supplierId ? { supplier_id: supplierId } : {}),
      qty_available: validatedData.qty_available,
      // Immutable record of what was received (qty_available changes as stock is sold/adjusted)
      qty_received: validatedData.qty_available,
      cost_price: validatedData.cost_price,
      selling_price: validatedData.selling_price,
      expiry_date: validatedData.expiry_date || "",
      tenant_id: tenantId,
      created_at: now,
    };

    // Batch + PURCHASE ledger entry must land together, otherwise stock exists without a ledger trail.
    const executeReceive = async (sessionParam?: any) => {
      const opts: any = sessionParam ? { session: sessionParam } : {};
      const batchResult = await db.collection("batches").insertOne({ ...newBatch }, opts);
      const batchId = batchResult.insertedId;
      await db.collection("stock_movements").insertOne({
        tenant_id: tenantId,
        product_id: validatedData.product_id,
        batch_id: batchId.toString(),
        movement_type: "PURCHASE",
        quantity: validatedData.qty_available,
        before_qty: 0,
        after_qty: validatedData.qty_available,
        notes: supplierName ? `Initial batch receiving from ${supplierName}` : "Initial batch receiving",
        created_by: (session?.user as any)?.id || "System",
        created_at: now
      }, opts);
      return batchId;
    };

    let insertedId: ObjectId | undefined;
    try {
      const dbSession = client.startSession();
      try {
        await dbSession.withTransaction(async () => {
          insertedId = await executeReceive(dbSession);
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
        // Standalone server (local dev): no multi-document transactions available
        insertedId = await executeReceive();
      } else {
        throw txnError;
      }
    }

    audit.setAfter({ _id: insertedId, ...newBatch });

    return NextResponse.json({ _id: insertedId, message: "Batch added and stock recorded" }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "This batch number already exists for this product" }, { status: 409 });
    }
    return await handleApiError(error, "POST /api/inventory/batches");
  }
});
