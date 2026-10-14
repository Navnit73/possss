import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { saleSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ClientSession, Db, ObjectId } from "mongodb";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { checkPermissionAny } from "@/lib/rbac";
import { POS_TAX_RATE, lineAmount, round2 } from "@/lib/posMath";
import { getStoreToday, isExpired } from "@/lib/storeTime";

/** A problem with the sale itself (stock, expiry, discount…): reported to the cashier as a 400. */
class SaleError extends Error {}

/** Makes sure this year's invoice counter exists, seeded from any invoices created before counters were introduced. */
async function ensureInvoiceCounter(db: Db, tenantId: string, year: string) {
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const counterId = `invoice_${tenantId}_${year}`;
  if (await counters.findOne({ _id: counterId }, { projection: { _id: 1 } })) return counterId;

  const lastSales = await db.collection("sales")
    .find({ tenant_id: tenantId, invoice_no: { $regex: `^INV-${year}-` } }, { projection: { invoice_no: 1 } })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  const maxSeq = lastSales.reduce((max, sale) => {
    const num = parseInt(String(sale.invoice_no).split("-").pop() ?? "", 10);
    return Number.isNaN(num) ? max : Math.max(max, num);
  }, 0);

  try {
    await counters.insertOne({ _id: counterId, seq: maxSeq });
  } catch (err: any) {
    if (err?.code !== 11000) throw err; // another request created it first — fine
  }
  return counterId;
}

export const POST = withAuditLog("SALE", "POS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "POS", action: "CREATE" },
      { module: "SALES", action: "CREATE" },
    ]);
    if (permError) return permError;
    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data = saleSchema.parse(body);

    const db = client.db("pos");
    const sales = db.collection("sales");

    // Same checkout submitted twice (double click, retry after a timeout): return the sale already created.
    const { idempotency_key: idempotencyKey, ...billable } = data;
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(billable)).digest("hex");
    if (idempotencyKey) {
      const existing = await sales.findOne({ tenant_id: tenantId, idempotency_key: idempotencyKey }, { projection: { invoice_no: 1, total: 1, idempotency_fingerprint: 1 } });
      if (existing) {
        if (existing.idempotency_fingerprint !== fingerprint) {
          return NextResponse.json({ error: "This checkout was already submitted with different items. Please start a new sale." }, { status: 409 });
        }
        return NextResponse.json({ success: true, sale_id: existing._id.toString(), invoice_no: existing.invoice_no, total: existing.total, duplicate: true });
      }
    }

    const batchIds = [...new Set(data.items.map((i) => i.batch_id))];
    const productIds = [...new Set(data.items.map((i) => i.product_id))];
    const today = await getStoreToday(db, tenantId);
    const year = today.slice(0, 4);

    // Independent reads, done together
    const [customer, products, counterId] = await Promise.all([
      data.customer_id
        ? db.collection("customers").findOne({ _id: new ObjectId(data.customer_id), tenant_id: tenantId }, { projection: { _id: 1 } })
        : null,
      db.collection("products").find({ _id: { $in: productIds.map((id) => new ObjectId(id)) }, tenant_id: tenantId }, { projection: { name: 1, status: 1 } }).toArray(),
      ensureInvoiceCounter(db, tenantId, year),
    ]);
    if (data.customer_id && !customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    for (const id of productIds) {
      const product = productMap.get(id);
      if (!product) throw new SaleError("A medicine in the cart no longer exists. Remove it and try again.");
      if (product.status !== "ACTIVE") throw new SaleError(`${product.name} is inactive and can't be sold.`);
    }

    let result: { saleId: string; invoiceNo: string; total: number } | undefined;

    const executeSale = async (session: ClientSession) => {
      // One read + one bulk update for all the stock, instead of a round trip per cart line
      const batches = await db.collection("batches")
        .find({ _id: { $in: batchIds.map((id) => new ObjectId(id)) }, tenant_id: tenantId }, { session })
        .toArray();
      const batchMap = new Map(batches.map((b) => [b._id.toString(), b]));

      const requested = new Map<string, number>();
      for (const item of data.items) {
        const batch = batchMap.get(item.batch_id);
        const name = productMap.get(item.product_id)!.name;
        if (!batch) throw new SaleError(`A batch of ${name} no longer exists. Search for it again.`);
        if (batch.product_id !== item.product_id) throw new SaleError("Selected batch does not belong to the selected product");
        if (isExpired(batch.expiry_date, today)) throw new SaleError(`Batch #${batch.batch_number} of ${name} has expired and can't be sold.`);
        if (!(batch.selling_price > 0)) throw new SaleError(`${name} (batch #${batch.batch_number}) has no selling price set.`);
        requested.set(item.batch_id, (requested.get(item.batch_id) ?? 0) + item.qty);
      }
      for (const [batchId, qty] of requested) {
        const batch = batchMap.get(batchId)!;
        if (batch.qty_available < qty) {
          throw new SaleError(`Insufficient stock for ${productMap.get(batch.product_id)!.name}: only ${batch.qty_available} left, ${qty} requested.`);
        }
      }

      // The qty filter is the real guard against overselling when two cashiers sell the last units at once
      const stockUpdate = await db.collection("batches").bulkWrite(
        [...requested].map(([batchId, qty]) => ({
          updateOne: {
            filter: { _id: new ObjectId(batchId), tenant_id: tenantId, qty_available: { $gte: qty } },
            update: { $inc: { qty_available: -qty } },
          },
        })),
        { session }
      );
      if (stockUpdate.modifiedCount !== requested.size) {
        throw new SaleError("Stock changed while you were checking out. Please review the cart and try again.");
      }

      // Inside the transaction so a failed sale never burns an invoice number (no gaps in the sequence)
      const counter = await db.collection<{ _id: string; seq: number }>("counters").findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { returnDocument: "after", session }
      );
      const invoiceNo = `INV-${year}-${String(counter?.seq ?? 1).padStart(4, "0")}`;

      const remaining = new Map(batches.map((b) => [b._id.toString(), b.qty_available as number]));
      const saleItems = [];
      const stockMovements = [];
      const lineTotals: number[] = [];
      const now = new Date();

      for (const item of data.items) {
        const batch = batchMap.get(item.batch_id)!;
        const line = lineAmount(batch.selling_price, item.qty, item.discount);
        lineTotals.push(line);

        const before = remaining.get(item.batch_id)!;
        remaining.set(item.batch_id, before - item.qty);

        saleItems.push({
          product_id: item.product_id,
          batch_id: item.batch_id,
          qty: item.qty,
          price: batch.selling_price,
          cost_price: batch.cost_price,
          discount: item.discount,
          profit: round2(line - batch.cost_price * item.qty),
        });
        stockMovements.push({
          tenant_id: tenantId,
          product_id: item.product_id,
          batch_id: item.batch_id,
          movement_type: "SALE",
          quantity: -item.qty,
          before_qty: before,
          after_qty: before - item.qty,
          notes: `Sold on invoice ${invoiceNo}`,
          created_by: userId,
          created_at: now,
        });
      }

      const subtotal = round2(lineTotals.reduce((sum, a) => sum + a, 0));
      const discount = round2(data.discount);
      if (discount > subtotal + 0.005) {
        throw new SaleError(`Discount (${discount}) cannot exceed subtotal (${subtotal})`);
      }
      const afterDiscount = round2(subtotal - discount);
      const tax = round2(afterDiscount * POS_TAX_RATE);
      const total = round2(afterDiscount + tax);

      const sale: Record<string, unknown> = {
        tenant_id: tenantId,
        invoice_no: invoiceNo,
        subtotal,
        tax,
        discount,
        total,
        payment_method: data.payment_method,
        created_by: userId,
        created_at: now,
      };
      if (data.customer_id) sale.customer_id = data.customer_id;
      if (idempotencyKey) {
        sale.idempotency_key = idempotencyKey;
        sale.idempotency_fingerprint = fingerprint;
      }

      const saleResult = await sales.insertOne(sale, { session });
      const saleId = saleResult.insertedId.toString();

      await Promise.all([
        db.collection("sale_items").insertMany(saleItems.map((si) => ({ ...si, sale_id: saleId, tenant_id: tenantId })), { session }),
        db.collection("stock_movements").insertMany(stockMovements, { session }),
      ]);

      if (data.customer_id) {
        await db.collection("customers").updateOne(
          { _id: new ObjectId(data.customer_id), tenant_id: tenantId },
          { $inc: { lifetime_spending: total }, $set: { last_visit: now } },
          { session }
        );
      }

      result = { saleId, invoiceNo, total };
    };

    const sessionClient = client.startSession();
    try {
      await sessionClient.withTransaction(async () => {
        await executeSale(sessionClient);
      });
    } catch (txErr: any) {
      if (txErr?.message && (txErr.message.includes("Transaction numbers are only allowed") || txErr.message.includes("replica set"))) {
        return NextResponse.json({ error: "Sales are temporarily unavailable because the database does not support transactions." }, { status: 503 });
      }
      // Two identical submissions raced: the unique idempotency index rejected the second — hand back the first sale.
      if (txErr?.code === 11000 && idempotencyKey) {
        const existing = await sales.findOne({ tenant_id: tenantId, idempotency_key: idempotencyKey });
        if (existing) {
          return NextResponse.json({ success: true, sale_id: existing._id.toString(), invoice_no: existing.invoice_no, total: existing.total, duplicate: true });
        }
      }
      throw txErr;
    } finally {
      await sessionClient.endSession();
    }

    audit.setAfter({ sale_id: result!.saleId, invoice_no: result!.invoiceNo, items_count: data.items.length });

    return NextResponse.json({ success: true, sale_id: result!.saleId, invoice_no: result!.invoiceNo, total: result!.total }, { status: 201 });
  } catch (error: any) {
    if (error instanceof SaleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return await handleApiError(error, "POST /api/pos/sell");
  }
});
