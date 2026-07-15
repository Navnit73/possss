import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { customerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    const permError = checkPermission(session, "CUSTOMERS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    // Validate ObjectId
    let objectId;
    try {
      objectId = new ObjectId(resolvedParams.id);
    } catch {
      return NextResponse.json({ error: "Invalid customer ID format" }, { status: 400 });
    }

    const customer = await db.collection("customers").findOne({
      _id: objectId,
      tenant_id: tenantId
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get purchase history (sales associated with this customer)
    const sales = await db.collection("sales")
      .find({ tenant_id: tenantId, customer_id: resolvedParams.id })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    const totalSalesCount = await db.collection("sales").countDocuments({ 
      tenant_id: tenantId, 
      customer_id: resolvedParams.id 
    });

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

    const body = await req.json();
    const validatedData = customerSchema.parse(body);

    const db = client.db("pos");
    
    let objectId;
    try {
      objectId = new ObjectId(resolvedParams.id);
    } catch {
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
    
    let objectId;
    try {
      objectId = new ObjectId(resolvedParams.id);
    } catch {
      return NextResponse.json({ error: "Invalid customer ID format" }, { status: 400 });
    }

    // Check if customer has associated sales
    const salesCount = await db.collection("sales").countDocuments({
      tenant_id: tenantId,
      customer_id: resolvedParams.id
    });

    if (salesCount > 0) {
      // Soft delete / Inactivate instead
      await db.collection("customers").updateOne(
        { _id: objectId, tenant_id: tenantId },
        { $set: { status: "INACTIVE", updated_at: new Date() } }
      );
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
