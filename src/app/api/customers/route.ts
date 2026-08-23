import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { customerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "CUSTOMERS", action: "VIEW" },
      { module: "POS", action: "VIEW" },
      { module: "SALES", action: "VIEW" },
      { module: "SALES", action: "CREATE" }
    ]);
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").slice(0, 100);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "10", 10) || 10));
    const skip = (page - 1) * limit;

    const db = client.db("pos");
    
    // Escape special characters in the search query for safe regex use
    const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query: any = { tenant_id: tenantId };
    if (escapedQ) {
      query.$or = [
        { name: { $regex: escapedQ, $options: "i" } },
        { phone: { $regex: escapedQ, $options: "i" } },
        { email: { $regex: escapedQ, $options: "i" } },
        { customer_id: { $regex: escapedQ, $options: "i" } }
      ];
    }

    const customers = await db.collection("customers")
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection("customers").countDocuments(query);

    return NextResponse.json({
      customers,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/customers");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermissionAny(session, [
      { module: "CUSTOMERS", action: "CREATE" },
      { module: "POS", action: "CREATE" },
      { module: "POS", action: "VIEW" },
      { module: "SALES", action: "CREATE" }
    ]);
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = customerSchema.parse(body);

    const db = client.db("pos");
    
    let customerId = validatedData.customer_id;
    
    // Auto-generate customer ID if not provided
    if (!customerId) {
      const year = new Date().getFullYear();
      const lastCustomer = await db.collection("customers").find({ 
        tenant_id: tenantId,
        customer_id: { $regex: `^CUST-${year}-` }
      }).sort({ created_at: -1 }).limit(1).toArray();

      let seq = 1;
      if (lastCustomer.length > 0 && lastCustomer[0].customer_id) {
        const parts = lastCustomer[0].customer_id.split('-');
        if (parts.length === 3) {
          seq = parseInt(parts[2]) + 1;
        }
      }
      customerId = `CUST-${year}-${seq.toString().padStart(4, '0')}`;
    } else {
      // Check if provided ID is unique
      const existing = await db.collection("customers").findOne({
        tenant_id: tenantId,
        customer_id: customerId
      });
      if (existing) {
        return NextResponse.json({ error: "Customer ID already exists" }, { status: 400 });
      }
    }

    const newCustomer = {
      ...validatedData,
      customer_id: customerId,
      tenant_id: tenantId,
      lifetime_spending: 0,
      outstanding_balance: 0,
      store_credit: 0,
      loyalty_points: 0,
      created_at: new Date()
    };

    const result = await db.collection("customers").insertOne(newCustomer);

    return NextResponse.json({ _id: result.insertedId, message: "Customer created successfully" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/customers");
  }
}
