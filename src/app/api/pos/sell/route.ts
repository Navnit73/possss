import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { saleSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    const userId = session?.user?.id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = saleSchema.parse(body);

    const db = client.db("pos");
    const sessionClient = client.startSession();

    let insertedSaleId: string = "";

    try {
      await sessionClient.withTransaction(async () => {
        // Generate Invoice Number: INV-YYYY-XXXX
        const year = new Date().getFullYear();
        // find highest invoice number for this year
        const lastSale = await db.collection("sales").find({ 
          tenant_id: tenantId,
          invoice_no: { $regex: `^INV-${year}-` }
        }).sort({ created_at: -1 }).limit(1).toArray();

        let seq = 1;
        if (lastSale.length > 0) {
          const parts = lastSale[0].invoice_no.split('-');
          seq = parseInt(parts[2]) + 1;
        }
        
        const invoiceNo = `INV-${year}-${seq.toString().padStart(4, '0')}`;

        // Prepare Sale Items and Inventory updates FIRST to calculate true server totals
        const saleItems = [];
        const stockMovements = [];
        let serverSubtotal = 0;

        for (const item of validatedData.items) {
          // Atomic deduction: find and update in one operation to prevent race conditions
          const batch = await db.collection("batches").findOneAndUpdate(
            { 
              _id: new ObjectId(item.batch_id), 
              tenant_id: tenantId,
              qty_available: { $gte: item.qty }
            },
            { $inc: { qty_available: -item.qty } },
            { session: sessionClient, returnDocument: 'before' }
          );

          if (!batch) {
            throw new Error(`Insufficient stock or batch not found for product ${item.product_id}`);
          }

          // CRITICAL FIX: The server is the absolute source of truth for pricing
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

          // Record Stock Movement
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

        // Calculate final server total
        const serverDiscountTotal = validatedData.discount;
        if (serverDiscountTotal > serverSubtotal) {
          throw new Error(`Discount (${serverDiscountTotal}) cannot exceed subtotal (${serverSubtotal})`);
        }
        const serverTotalAfterDiscount = serverSubtotal - serverDiscountTotal;
        const serverTaxAmount = validatedData.tax;
        const serverGrandTotal = serverTotalAfterDiscount + serverTaxAmount;

        // Tolerance check for floating point maths (allow 2 cents difference)
        if (Math.abs(serverGrandTotal - validatedData.total) > 0.02) {
          throw new Error(`PRICE_MISMATCH: Server calculated ${serverGrandTotal.toFixed(2)}, but client requested ${validatedData.total.toFixed(2)}. This attempt has been blocked.`);
        }

        // Create Sale using verified server totals
        const sale: any = {
          tenant_id: tenantId,
          invoice_no: invoiceNo,
          subtotal: serverSubtotal,
          tax: validatedData.tax,
          discount: validatedData.discount,
          total: serverGrandTotal,
          payment_method: validatedData.payment_method,
          created_by: userId,
          created_at: new Date()
        };

        if (validatedData.customer_id) {
          sale.customer_id = validatedData.customer_id;
        }

        const saleResult = await db.collection("sales").insertOne(sale, { session: sessionClient });
        insertedSaleId = saleResult.insertedId.toString();

        // Update saleItems with insertedSaleId
        const finalSaleItems = saleItems.map(si => ({ ...si, sale_id: insertedSaleId }));

        // Insert all sale items
        await db.collection("sale_items").insertMany(finalSaleItems, { session: sessionClient });
        
        // Insert all stock movements
        await db.collection("stock_movements").insertMany(stockMovements, { session: sessionClient });
        
        // Update customer stats if applicable
        if (validatedData.customer_id) {
          await db.collection("customers").updateOne(
            { _id: new ObjectId(validatedData.customer_id), tenant_id: tenantId },
            { 
              $inc: { lifetime_spending: serverGrandTotal },
              $set: { last_visit: new Date() }
            },
            { session: sessionClient }
          );
        }
      });
    } finally {
      await sessionClient.endSession();
    }

    return NextResponse.json({ success: true, sale_id: insertedSaleId }, { status: 201 });
  } catch (error: any) {
    if (error.message && (
      error.message.includes("Insufficient stock") || 
      error.message.includes("Batch not found") ||
      error.message.includes("PRICE_MISMATCH") ||
      error.message.includes("cannot exceed subtotal")
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return await handleApiError(error, "POST /api/pos/sell");
  }
}
