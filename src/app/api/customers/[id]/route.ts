import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { customerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";

/** new ObjectId() also accepts any 12-character string, which would then never match the hex customer_id stored on sales. */
function parseId(id: string): ObjectId | null {
  return /^[0-9a-fA-F]{24}$/.test(id) ? new ObjectId(id) : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    const permError = checkPermission(session, "CUSTOMERS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    const objectId = parseId(resolvedParams.id);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid customer ID format" }, { status: 400 });
    }
    // Sales store the customer's id as a lowercase hex string
    const customerKey = objectId.toHexString();

    // Customer, recent purchases and purchase count are independent: fetch them together
    const [customer, sales, totalSalesCount] = await Promise.all([
      db.collection("customers").findOne({ _id: objectId, tenant_id: tenantId }),
      db.collection("sales")
        .find(
          { tenant_id: tenantId, customer_id: customerKey },
          { projection: { invoice_no: 1, payment_method: 1, total: 1, created_at: 1 } }
        )
        .sort({ created_at: -1 })
        .limit(10)
        .toArray(),
      db.collection("sales").countDocuments({ tenant_id: tenantId, customer_id: customerKey }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...customer,
      recent_sales: sales,
      total_sales_count: totalSalesCount
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/customers/[id]");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    const permError = checkPermission(session, "CUSTOMERS", "EDIT");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const validatedData = customerSchema.parse(body);
    // The schema defaults status to ACTIVE: an update that doesn't mention status must not silently reactivate a customer
    if (body.status === undefined) delete (validatedData as Partial<typeof validatedData>).status;
    // A blank id would wipe the customer's existing number
    const newCustomerId = validatedData.customer_id?.trim();
    if (newCustomerId) validatedData.customer_id = newCustomerId;
    else delete validatedData.customer_id;

    const db = client.db("pos");
    
    const objectId = parseId(resolvedParams.id);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid customer ID format" }, { status: 400 });
    }

    // Check if customer_id is being changed to an existing one
    if (validatedData.customer_id) {
      const existing = await db.collection("customers").findOne({
        tenant_id: tenantId,
        customer_id: validatedData.customer_id,
        _id: { $ne: objectId }
      });
      if (existing) {
        return NextResponse.json({ error: "Customer ID already exists" }, { status: 400 });
      }
    }

    const updateData = {
      ...validatedData,
      updated_at: new Date()
    };

    const result = await db.collection("customers").updateOne(
      { _id: objectId, tenant_id: tenantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Customer updated successfully" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/customers/[id]");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    const permError = checkPermission(session, "CUSTOMERS", "DELETE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    const objectId = parseId(resolvedParams.id);
    if (!objectId) {
      return NextResponse.json({ error: "Invalid customer ID format" }, { status: 400 });
    }
    // Sales store the customer's id as a lowercase hex string
    const customerKey = objectId.toHexString();

    // Check if customer has associated sales
    const salesCount = await db.collection("sales").countDocuments({
      tenant_id: tenantId,
      customer_id: customerKey
    });

    if (salesCount > 0) {
      // Soft delete / Inactivate instead
      const updated = await db.collection("customers").updateOne(
        { _id: objectId, tenant_id: tenantId },
        { $set: { status: "INACTIVE", updated_at: new Date() } }
      );
      if (updated.matchedCount === 0) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      return NextResponse.json({ message: "Customer has associated sales. Status changed to INACTIVE." });
    }

    const result = await db.collection("customers").deleteOne({
      _id: objectId,
      tenant_id: tenantId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error: any) {
    return await handleApiError(error, "DELETE /api/customers/[id]");
  }
}
