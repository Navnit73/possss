import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
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

    // Build query - allow search by ObjectId or invoice_no
    const saleQuery: any = { tenant_id: tenantId };
    // ObjectId.isValid() also accepts any 12-character string (e.g. a 12-char invoice number), so match the hex form explicitly
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      saleQuery._id = new ObjectId(id);
    } else {
      saleQuery.invoice_no = id;
    }

    const sale = await db.collection("sales").findOne(saleQuery, { projection: { idempotency_key: 0, idempotency_fingerprint: 0 } });
    if (!sale) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch sale items with product and batch details
    const saleIdStr = sale._id.toString();
    // cost_price / profit stay server-side: this endpoint is open to cashiers (same rule as /api/pos/search)
    const rawSaleItems = await db.collection("sale_items")
      .find({ sale_id: saleIdStr }, { projection: { cost_price: 0, profit: 0 } })
      .toArray();

    // Collect product & batch IDs
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

    const items = rawSaleItems.map(item => {
      const product = productMap.get(item.product_id);
      const batch = batchMap.get(item.batch_id);
      return {
        ...item,
        name: product?.name || "Medicine Item",
        generic_name: product?.generic_name || "",
        dosage_form: product?.dosage_form || "",
        unit_of_measure: product?.unit_of_measure || "unit",
        batch_number: batch?.batch_number || "N/A",
        expiry_date: batch?.expiry_date || ""
      };
    });

    return NextResponse.json({
      sale,
      items,
      tenant: tenant ? {
        business_name: tenant.business_name || "Pharmacy Store",
        country: tenant.country || "",
        currency: tenant.currency || "$",
        phone: tenant.phone || "",
        address: tenant.address || ""
      } : {
        business_name: "Medishelf POS",
        currency: "$"
      },
      customer: customer ? {
        name: customer.name,
        phone: customer.phone,
        email: customer.email
      } : null
    });

  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/invoices/[id]");
  }
}
