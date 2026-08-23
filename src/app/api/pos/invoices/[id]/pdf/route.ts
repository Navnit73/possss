import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";
import { checkPermissionAny } from "@/lib/rbac";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "POS", action: "CREATE" },
      { module: "POS", action: "VIEW" },
      { module: "SALES", action: "CREATE" },
      { module: "SALES", action: "VIEW" },
    ]);
    if (permError) return permError;
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const { id } = params;

    let saleQuery: any = { tenant_id: tenantId };
    if (ObjectId.isValid(id)) {
      saleQuery._id = new ObjectId(id);
    } else {
      saleQuery.invoice_no = id;
    }

    const sale = await db.collection("sales").findOne(saleQuery);
    if (!sale) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const saleIdStr = sale._id.toString();
    const rawSaleItems = await db.collection("sale_items").find({ sale_id: saleIdStr }).toArray();

    const productObjectIds = rawSaleItems
      .map(item => ObjectId.isValid(item.product_id) ? new ObjectId(item.product_id) : null)
      .filter(Boolean) as ObjectId[];

    const batchObjectIds = rawSaleItems
      .map(item => ObjectId.isValid(item.batch_id) ? new ObjectId(item.batch_id) : null)
      .filter(Boolean) as ObjectId[];

    const [products, batches, tenant, customer] = await Promise.all([
      db.collection("products").find({ _id: { $in: productObjectIds }, tenant_id: tenantId }).toArray(),
      db.collection("batches").find({ _id: { $in: batchObjectIds }, tenant_id: tenantId }).toArray(),
      db.collection("tenants").findOne({ _id: ObjectId.isValid(tenantId) ? new ObjectId(tenantId) : tenantId }),
      sale.customer_id && ObjectId.isValid(sale.customer_id) 
        ? db.collection("customers").findOne({ _id: new ObjectId(sale.customer_id), tenant_id: tenantId })
        : null
    ]);

    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    const batchMap = new Map(batches.map(b => [b._id.toString(), b]));

    const items = rawSaleItems.map((item: any) => {
      const product = productMap.get(item.product_id);
      const batch = batchMap.get(item.batch_id);
      return {
        ...item,
        name: product?.name || "Medicine Item",
        generic_name: product?.generic_name || "",
        unit_of_measure: product?.unit_of_measure || "unit",
        batch_number: batch?.batch_number || "N/A"
      };
    });

    const CURRENCY_SYMBOLS: Record<string, string> = {
      USD: "$",
      INR: "₹",
      EUR: "€",
      GBP: "£",
      CAD: "CA$",
      AUD: "A$",
    };
    const currencySymbol = CURRENCY_SYMBOLS[(tenant?.currency || "USD").toUpperCase()] || tenant?.currency || "$";

    const storeName = tenant?.business_name || "PHARMACY STORE";
    const storeAddress = tenant?.address || "";
    const storePhone = tenant?.phone || "";

    // Dynamic height calculation based on item count
    const itemLinesHeight = items.reduce((acc: number, item: any) => acc + (item.batch_number ? 20 : 12), 0);
    const pdfHeight = Math.max(320, 160 + itemLinesHeight + (customer ? 15 : 0) + (sale.discount > 0 ? 12 : 0));

    // Generate 80mm Thermal Receipt PDF (width: 226pt / 80mm)
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: [226, pdfHeight], 
          margin: 8 
        });

        const chunks: Buffer[] = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", err => reject(err));

        const startX = 8;
        const width = 210;

        const drawDashedLine = (yPos: number) => {
          doc.save()
             .moveTo(startX, yPos)
             .lineTo(startX + width, yPos)
             .dash(3, { space: 2 })
             .lineWidth(0.5)
             .stroke("#555555")
             .restore();
        };

        const drawSolidLine = (yPos: number, weight = 0.5, color = "#000000") => {
          doc.moveTo(startX, yPos)
             .lineTo(startX + width, yPos)
             .lineWidth(weight)
             .stroke(color);
        };

        // 1. Header
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000").text(storeName.toUpperCase(), startX, 10, { align: "center", width });
        doc.font("Helvetica").fontSize(7).fillColor("#444444");
        if (storeAddress) doc.text(storeAddress, startX, doc.y, { align: "center", width });
        if (storePhone) doc.text(`Ph: ${storePhone}`, startX, doc.y, { align: "center", width });
        
        doc.moveDown(0.3);
        drawSolidLine(doc.y, 1);
        doc.moveDown(0.4);

        // 2. Invoice & Date Meta
        doc.fontSize(7).fillColor("#000000");
        doc.text(`INV #: ${sale.invoice_no || sale._id.toString().substring(0, 8)}`, startX, doc.y);
        doc.text(`DATE : ${new Date(sale.created_at || Date.now()).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}`, startX, doc.y);
        if (customer) {
          doc.text(`CUST : ${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`, startX, doc.y);
        }

        doc.moveDown(0.3);
        drawDashedLine(doc.y);
        doc.moveDown(0.4);

        // 3. Table Header
        let tableY = doc.y;
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000");
        doc.text("ITEM", startX, tableY, { width: 108 });
        doc.text("QTY", startX + 110, tableY, { width: 22, align: "center" });
        doc.text("PRICE", startX + 134, tableY, { width: 32, align: "right" });
        doc.text("TOTAL", startX + 168, tableY, { width: 42, align: "right" });

        tableY += 10;
        drawSolidLine(tableY, 0.5);
        tableY += 4;

        // 4. Table Items
        for (const item of items) {
          const price = Number(item.price || 0);
          const qty = Number(item.qty || 0);
          const discount = Number(item.discount || 0);
          const lineTotal = (price * qty) * (1 - discount / 100);

          doc.fillColor("#000000").font("Helvetica-Bold");
          doc.text(String(item.name).substring(0, 22), startX, tableY, { width: 108 });
          
          doc.font("Helvetica");
          doc.text(qty.toString(), startX + 110, tableY, { width: 22, align: "center" });
          doc.text(`${currencySymbol}${price.toFixed(2)}`, startX + 134, tableY, { width: 32, align: "right" });
          doc.text(`${currencySymbol}${lineTotal.toFixed(2)}`, startX + 168, tableY, { width: 42, align: "right" });

          tableY += 10;
          if (item.batch_number) {
            doc.fontSize(6).fillColor("#555555").text(`Batch: #${item.batch_number}${discount > 0 ? ` (${discount}% off)` : ''}`, startX + 4, tableY);
            tableY += 8;
            doc.fontSize(7);
          }
        }

        doc.y = tableY + 2;
        drawDashedLine(doc.y);
        doc.moveDown(0.4);

        // 5. Summary & Totals
        const rightAlignOpts = { width: 60, align: "right" as const };
        doc.fontSize(7).font("Helvetica").fillColor("#000000");

        let sumY = doc.y;
        doc.text("Subtotal:", startX + 90, sumY, { width: 55 });
        doc.text(`${currencySymbol}${Number(sale.subtotal || 0).toFixed(2)}`, startX + 148, sumY, rightAlignOpts);

        if (sale.discount > 0) {
          sumY += 10;
          doc.text("Discount:", startX + 90, sumY, { width: 55 });
          doc.text(`-${currencySymbol}${Number(sale.discount || 0).toFixed(2)}`, startX + 148, sumY, rightAlignOpts);
        }

        sumY += 10;
        doc.text("Tax:", startX + 90, sumY, { width: 55 });
        doc.text(`${currencySymbol}${Number(sale.tax || 0).toFixed(2)}`, startX + 148, sumY, rightAlignOpts);

        sumY += 12;
        drawSolidLine(sumY, 1, "#000000");
        sumY += 4;

        doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000");
        doc.text("NET TOTAL:", startX + 80, sumY, { width: 65 });
        doc.text(`${currencySymbol}${Number(sale.total || 0).toFixed(2)}`, startX + 148, sumY, rightAlignOpts);

        sumY += 13;
        drawSolidLine(sumY, 0.5, "#000000");
        sumY += 4;

        // 6. Payment Badge
        doc.fontSize(7).font("Helvetica-Bold").fillColor("#000000");
        doc.text(`PAID VIA ${sale.payment_method}`, startX, sumY, { align: "center", width });

        // 7. Footer
        doc.moveDown(1.5);
        doc.fontSize(7).font("Helvetica").fillColor("#333333").text("Thank you for shopping with us!", startX, doc.y, { align: "center", width });
        doc.fontSize(6).fillColor("#777777").text("Please keep receipt for any returns or exchanges.", startX, doc.y + 2, { align: "center", width });
        doc.fontSize(5).fillColor("#aaaaaa").text("Powered by Pharmacy POS", startX, doc.y + 3, { align: "center", width });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt_${sale.invoice_no}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/invoices/[id]/pdf");
  }
}
