import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { saleSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { checkPermissionAny } from "@/lib/rbac";

const POS_TAX_RATE = 0.05;

async function generateInvoiceNo(db: any, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `invoice_${tenantId}_${year}`;
  
  // 1. Try atomic increment for existing counter
  let counter = await db.collection("counters").findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { returnDocument: 'after' }
  );

  // 2. If counter doc does not exist yet, find max invoice_no sequence from existing sales
  if (!counter) {
    const lastSales = await db.collection("sales").find({ 
      tenant_id: tenantId,
      invoice_no: { $regex: `^INV-${year}-` }
    }).sort({ created_at: -1 }).limit(50).toArray();

    let maxSeq = 0;
    for (const sale of lastSales) {
      if (sale.invoice_no) {
        const parts = sale.invoice_no.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }

    const nextSeq = maxSeq + 1;

    try {
      await db.collection("counters").insertOne({
        _id: counterId,
        seq: nextSeq
      });
      counter = { seq: nextSeq };
    } catch (e: any) {
      // Handle concurrent first creation gracefully
      counter = await db.collection("counters").findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { returnDocument: 'after' }
      );
    }
  }

  const seq = counter?.seq || 1;
  return `INV-${year}-${seq.toString().padStart(4, '0')}`;
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
    const validatedData = saleSchema.parse(body);

    const db = client.db("pos");
    let insertedSaleId: string = "";

    if (validatedData.customer_id) {
      const customer = await db.collection("customers").findOne({
        _id: new ObjectId(validatedData.customer_id),
        tenant_id: tenantId,
      }, { projection: { _id: 1 } });
      if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 400 });
    }

    const executeSale = async (sessionOpts: { session?: any } = {}) => {
      const invoiceNo = await generateInvoiceNo(db, tenantId);

      const saleItems = [];
      const stockMovements = [];
      let serverSubtotal = 0;

      for (const item of validatedData.items) {
        const batch = await db.collection("batches").findOneAndUpdate(
          { 
            _id: new ObjectId(item.batch_id), 
            tenant_id: tenantId,
            qty_available: { $gte: item.qty }
          },
          { $inc: { qty_available: -item.qty } },
          { ...sessionOpts, returnDocument: 'before' }
        );

        if (!batch) {
          throw new Error(`Insufficient stock or batch not found for product ${item.product_id}`);
        }
        if (batch.product_id !== item.product_id) {
          throw new Error("Selected batch does not belong to the selected product");
        }

        const actualPrice = batch.selling_price;
        const actualCost = batch.cost_price;

        const lineTotal = actualPrice * item.qty;
        const lineDiscountAmt = lineTotal * (item.discount / 100);
        const finalLinePrice = lineTotal - lineDiscountAmt;
        
        serverSubtotal += finalLinePrice;
        const profit = finalLinePrice - (actualCost * item.qty);

        saleItems.push({
          product_id: item.product_id,
          batch_id: item.batch_id,
          qty: item.qty,
          price: actualPrice,
          cost_price: actualCost,
          discount: item.discount,
          profit: profit
        });

        stockMovements.push({
          tenant_id: tenantId,
          product_id: item.product_id,
          batch_id: item.batch_id,
          movement_type: "SALE",
          quantity: -item.qty,
          before_qty: batch.qty_available,
          after_qty: batch.qty_available - item.qty,
          notes: `Sold on invoice ${invoiceNo}`,
          created_by: userId,
          created_at: new Date()
        });
      }

      const serverDiscountTotal = validatedData.discount;
      if (serverDiscountTotal > serverSubtotal) {
        throw new Error(`Discount (${serverDiscountTotal}) cannot exceed subtotal (${serverSubtotal})`);
      }
      const serverTotalAfterDiscount = serverSubtotal - serverDiscountTotal;
      const serverTaxAmount = Number((serverTotalAfterDiscount * POS_TAX_RATE).toFixed(2));
      const serverGrandTotal = serverTotalAfterDiscount + serverTaxAmount;

      const sale: any = {
        tenant_id: tenantId,
        invoice_no: invoiceNo,
        subtotal: serverSubtotal,
        tax: serverTaxAmount,
        discount: validatedData.discount,
        total: serverGrandTotal,
        payment_method: validatedData.payment_method,
        created_by: userId,
        created_at: new Date()
      };

      if (validatedData.customer_id) {
        sale.customer_id = validatedData.customer_id;
      }

      const saleResult = await db.collection("sales").insertOne(sale, sessionOpts);
      insertedSaleId = saleResult.insertedId.toString();

      const finalSaleItems = saleItems.map(si => ({ ...si, sale_id: insertedSaleId }));

      await db.collection("sale_items").insertMany(finalSaleItems, sessionOpts);
      await db.collection("stock_movements").insertMany(stockMovements, sessionOpts);

      if (validatedData.customer_id) {
        await db.collection("customers").updateOne(
          { _id: new ObjectId(validatedData.customer_id), tenant_id: tenantId },
          { 
            $inc: { lifetime_spending: serverGrandTotal },
            $set: { last_visit: new Date() }
          },
          sessionOpts
        );
      }
    };

    try {
      const sessionClient = client.startSession();
      try {
        await sessionClient.withTransaction(async () => {
          await executeSale({ session: sessionClient });
        });
      } catch (txErr: any) {
        if (txErr.message && (txErr.message.includes("Transaction numbers are only allowed") || txErr.message.includes("replica set"))) {
          throw new Error("TRANSACTIONS_REQUIRED");
        } else {
          throw txErr;
        }
      } finally {
        await sessionClient.endSession();
      }
    } catch (err: any) {
      if (err.message === "TRANSACTIONS_REQUIRED") {
        return NextResponse.json({ error: "Sales are temporarily unavailable because the database does not support transactions." }, { status: 503 });
      }
      if (err.message && (
        err.message.includes("Insufficient stock") || 
        err.message.includes("Batch not found") ||
        err.message.includes("cannot exceed subtotal") ||
        err.message.includes("does not belong")
      )) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    audit.setAfter({ sale_id: insertedSaleId, items_count: validatedData.items.length });

    return NextResponse.json({ success: true, sale_id: insertedSaleId }, { status: 201 });
  } catch (error: any) {
    if (error.message && (
      error.message.includes("Insufficient stock") || 
      error.message.includes("Batch not found") ||
      error.message.includes("cannot exceed subtotal") ||
      error.message.includes("does not belong")
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return await handleApiError(error, "POST /api/pos/sell");
  }
});
