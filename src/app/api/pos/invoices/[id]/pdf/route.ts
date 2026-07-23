import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import PDFDocument from "pdfkit";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await auth();
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
      db.collection("products").find({ _id: { $in: productObjectIds } }).toArray(),
      db.collection("batches").find({ _id: { $in: batchObjectIds } }).toArray(),
      db.collection("tenants").findOne({ _id: ObjectId.isValid(tenantId) ? new ObjectId(tenantId) : tenantId }),
      sale.customer_id && ObjectId.isValid(sale.customer_id) 
        ? db.collection("customers").findOne({ _id: new ObjectId(sale.customer_id) })
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

    const storeName = tenant?.business_name || "PHARMACY STORE";
    const storeAddress = tenant?.address || "";
    const storePhone = tenant?.phone || "";

    // Generate 80mm Thermal Receipt PDF (width: 226pt / 80mm)
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          size: [226, 600], 
          margin: 10 
        });

        const chunks: Buffer[] = [];
        doc.on("data", chunk => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", err => reject(err));

        const startX = 10;
        const width = 206;

        // Pharmacy Header
        doc.fontSize(12).font("Helvetica-Bold").text(storeName.toUpperCase(), startX, doc.y, { align: "center", width });
        if (storeAddress) {
          doc.fontSize(7).font("Helvetica").text(storeAddress, startX, doc.y, { align: "center", width });
        }
        if (storePhone) {
          doc.fontSize(7).font("Helvetica").text(`Tel: ${storePhone}`, startX, doc.y, { align: "center", width });
        }
        doc.fontSize(8).font("Helvetica-Bold").text("RETAIL TAX INVOICE", startX, doc.y + 4, { align: "center", width });
        doc.moveDown(0.5);

        // Divider
        doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).lineWidth(0.5).stroke("#000000");
        doc.moveDown(0.5);

        // Invoice Meta Info
        doc.fontSize(7).font("Helvetica");
        doc.text(`Invoice No: ${sale.invoice_no}`);
        doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
        doc.text(`Payment Method: ${sale.payment_method}`);
        if (customer) {
          doc.text(`Customer: ${customer.name}`);
        }
        doc.moveDown(0.5);

        // Divider
        doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).lineWidth(0.5).stroke("#000000");
        doc.moveDown(0.5);

        // Table Header
        let y = doc.y;
        doc.fontSize(7).font("Helvetica-Bold");
        doc.text("Item", startX, y);
        doc.text("Qty", startX + 115, y, { width: 25, align: "center" });
        doc.text("Price", startX + 140, y, { width: 30, align: "right" });
        doc.text("Total", startX + 170, y, { width: 36, align: "right" });

        y += 12;
        doc.moveTo(startX, y - 3).lineTo(startX + width, y - 3).lineWidth(0.5).stroke("#cccccc");

        // Items List
        doc.font("Helvetica").fontSize(7);
        for (const item of items) {
          const price = Number(item.price || 0);
          const qty = Number(item.qty || 0);
          const discount = Number(item.discount || 0);
          const lineTotal = (price * qty) * (1 - discount / 100);
          
          doc.text(String(item.name).substring(0, 24), startX, y, { width: 110 });
          doc.text(qty.toString(), startX + 115, y, { width: 25, align: "center" });
          doc.text(`$${price.toFixed(2)}`, startX + 140, y, { width: 30, align: "right" });
          doc.text(`$${lineTotal.toFixed(2)}`, startX + 170, y, { width: 36, align: "right" });
          
          y += 14;
          if (item.batch_number) {
            doc.fontSize(6).fillColor("#666666").text(`Batch: #${item.batch_number}`, startX + 5, y - 4);
            doc.fillColor("#000000").fontSize(7);
            y += 8;
          }
        }

        doc.y = y + 2;
        // Divider
        doc.moveTo(startX, doc.y).lineTo(startX + width, doc.y).lineWidth(0.5).stroke("#000000");
        doc.moveDown(0.5);

        // Totals
        const rightAlignOpts = { width: 60, align: "right" as const };
        
        doc.fontSize(7).font("Helvetica");
        doc.text("Subtotal:", startX + 100, doc.y, { width: 45 });
        doc.text(`$${Number(sale.subtotal || 0).toFixed(2)}`, startX + 145, doc.y - 8, rightAlignOpts);

        if (sale.discount > 0) {
          doc.text("Discount:", startX + 100, doc.y, { width: 45 });
          doc.text(`-$${Number(sale.discount || 0).toFixed(2)}`, startX + 145, doc.y - 8, rightAlignOpts);
        }

        doc.text("Tax:", startX + 100, doc.y, { width: 45 });
        doc.text(`$${Number(sale.tax || 0).toFixed(2)}`, startX + 145, doc.y - 8, rightAlignOpts);

        doc.moveDown(0.3);
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("TOTAL:", startX + 100, doc.y, { width: 45 });
        doc.text(`$${Number(sale.total || 0).toFixed(2)}`, startX + 145, doc.y - 10, rightAlignOpts);

        doc.moveDown(1.5);
        doc.fontSize(7).font("Helvetica").text("Thank you for your visit!", startX, doc.y, { align: "center", width });
        doc.fontSize(6).fillColor("#666666").text("Powered by Pharmacy POS", startX, doc.y + 2, { align: "center", width });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    return new NextResponse(pdfBuffer as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt_${sale.invoice_no}.pdf"`
      }
    });

  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/invoices/[id]/pdf");
  }
}
