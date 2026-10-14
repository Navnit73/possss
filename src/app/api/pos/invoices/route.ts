import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";
import { fromZonedTime } from "date-fns-tz";
import { escapeRegExp } from "@/lib/utils";
import { resolveTimezone } from "@/lib/storeTime";

const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export async function GET(req: Request) {
  try {
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

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q")?.trim() || "").slice(0, 100);
    const startDate = searchParams.get("startDate")?.trim() || "";
    const endDate = searchParams.get("endDate")?.trim() || "";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "50", 10) || 50));
    const skip = (page - 1) * limit;

    if ((startDate && !isDay(startDate)) || (endDate && !isDay(endDate))) {
      return NextResponse.json({ error: "Dates must be in YYYY-MM-DD format" }, { status: 400 });
    }

    const db = client.db("pos");

    const matchQuery: any = { tenant_id: tenantId };

    if (startDate || endDate) {
      // The picked dates are calendar days in the store's timezone, not UTC days
      const tenant = ObjectId.isValid(tenantId)
        ? await db.collection("tenants").findOne({ _id: new ObjectId(tenantId) }, { projection: { timezone: 1 } })
        : null;
      const tz = resolveTimezone(tenant?.timezone);
      matchQuery.created_at = {};
      if (startDate) {
        matchQuery.created_at.$gte = fromZonedTime(`${startDate}T00:00:00.000`, tz);
      }
      if (endDate) {
        matchQuery.created_at.$lte = fromZonedTime(`${endDate}T23:59:59.999`, tz);
      }
    }

    if (q) {
      const escaped = escapeRegExp(q);
      matchQuery.$or = [
        { invoice_no: { $regex: escaped, $options: "i" } },
        { payment_method: { $regex: escaped, $options: "i" } }
      ];
    }

    const [total, sales] = await Promise.all([
      db.collection("sales").countDocuments(matchQuery),
      db.collection("sales")
        .find(matchQuery, { projection: { idempotency_key: 0, idempotency_fingerprint: 0 } })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
    ]);

    // Collect customer IDs for name lookup
    const customerIds = sales
      .map(s => s.customer_id && ObjectId.isValid(s.customer_id) ? new ObjectId(s.customer_id) : null)
      .filter(Boolean) as ObjectId[];

    const customers = customerIds.length > 0
      ? await db.collection("customers").find({ _id: { $in: customerIds }, tenant_id: tenantId }, { projection: { name: 1 } }).toArray()
      : [];

    const customerMap = new Map(customers.map(c => [c._id.toString(), c.name]));

    const salesWithCustomers = sales.map(s => ({
      ...s,
      customer_name: s.customer_id ? (customerMap.get(s.customer_id) || "Walk-in Customer") : "Walk-in Customer"
    }));

    return NextResponse.json({
      invoices: salesWithCustomers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/invoices");
  }
}
