import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { customerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission, checkPermissionAny } from "@/lib/rbac";
import { escapeRegExp } from "@/lib/utils";
import type { Db } from "mongodb";

/** What the POS customer picker needs — callers without CUSTOMERS:VIEW get only this (no address, notes, DOB, balances). */
const PICKER_PROJECTION = { name: 1, phone: 1, email: 1, customer_id: 1, status: 1 };

/**
 * Next auto-generated CUST-<year>-NNNN id. An atomic counter (seeded once from existing ids), so two customers
 * created at the same moment can't both get the same number — the old "read last + 1" did exactly that.
 */
async function nextCustomerId(db: Db, tenantId: string, year: number): Promise<string> {
  const counters = db.collection<{ _id: string; seq: number }>("counters");
  const counterId = `customer_${tenantId}_${year}`;
  if (!(await counters.findOne({ _id: counterId }, { projection: { _id: 1 } }))) {
    const existing = await db.collection("customers")
      .find({ tenant_id: tenantId, customer_id: { $regex: `^CUST-${year}-` } }, { projection: { customer_id: 1 } })
      .toArray();
    const maxSeq = existing.reduce((max, c) => {
      const num = parseInt(String(c.customer_id).split("-").pop() ?? "", 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);
    try {
      await counters.insertOne({ _id: counterId, seq: maxSeq });
    } catch (err: any) {
      if (err?.code !== 11000) throw err; // another request seeded it first — fine
    }
  }
  const counter = await counters.findOneAndUpdate({ _id: counterId }, { $inc: { seq: 1 } }, { returnDocument: "after" });
  return `CUST-${year}-${String(counter?.seq ?? 1).padStart(4, "0")}`;
}

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
    const q = (searchParams.get("q") || "").trim().slice(0, 100);
    const status = searchParams.get("status");
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "10", 10) || 10));
    const skip = (page - 1) * limit;

    const db = client.db("pos");
    
    // Escape special characters in the search query for safe regex use
    const escapedQ = escapeRegExp(q);

    const query: any = { tenant_id: tenantId };
    // The POS asks for ACTIVE only, so deactivated (soft-deleted) customers can't be billed
    if (status === "ACTIVE" || status === "INACTIVE") query.status = status;
    if (escapedQ) {
      query.$or = [
        { name: { $regex: escapedQ, $options: "i" } },
        { phone: { $regex: escapedQ, $options: "i" } },
        { email: { $regex: escapedQ, $options: "i" } },
        { customer_id: { $regex: escapedQ, $options: "i" } }
      ];
    }

    const fullAccess = checkPermission(session, "CUSTOMERS", "VIEW") === null;
    const [customers, total] = await Promise.all([
      db.collection("customers")
        .find(query, fullAccess ? {} : { projection: PICKER_PROJECTION })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("customers").countDocuments(query),
    ]);

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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const validatedData = customerSchema.parse(body);

    const db = client.db("pos");
    
    let customerId = validatedData.customer_id?.trim();
    
    // Auto-generate customer ID if not provided
    if (!customerId) {
      const year = new Date().getFullYear();
      customerId = await nextCustomerId(db, tenantId, year);
      // A hand-typed custom id may already have taken this number: skip past it
      for (let i = 0; i < 5 && (await db.collection("customers").findOne({ tenant_id: tenantId, customer_id: customerId }, { projection: { _id: 1 } })); i++) {
        customerId = await nextCustomerId(db, tenantId, year);
      }
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
