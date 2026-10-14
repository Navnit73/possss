import { NextRequest, NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import client from "@/lib/mongodb";
import { auth } from "@/auth";
import { checkPermission } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";
import { getStoreToday } from "@/lib/storeTime";
import { MAX_EXPORT_ROWS, paginationMeta, parsePagination, parseSearch, productLookupStages, round2 } from "@/lib/reports/common";

const STATUSES = ["all", "expired", "30days", "60days", "90days"];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "REPORTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const params = new URL(req.url).searchParams;
    const search = parseSearch(params);
    const filterStatus = params.get("status") || "all";
    if (!STATUSES.includes(filterStatus)) return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    const { page, limit, skip, isExport } = parsePagination(params);

    // Expiry is judged by calendar date in the store's timezone (same rule as the POS)
    const todayStr = await getStoreToday(db, tenantId);
    const plus = (n: number) => format(addDays(parseISO(todayStr), n), "yyyy-MM-dd");
    const plus30Str = plus(30);
    const plus60Str = plus(60);
    const plus90Str = plus(90);

    // `$gt: ""` keeps only real dates: a blank expiry means "never expires" and must not sort as expired.
    const expiryRange: Record<string, Record<string, string>> = {
      expired: { $gt: "", $lt: todayStr },
      "30days": { $gte: todayStr, $lte: plus30Str },
      "60days": { $gt: plus30Str, $lte: plus60Str },
      "90days": { $gt: plus60Str, $lte: plus90Str },
      all: { $gt: "", $lte: plus90Str },
    };

    const batchMatch: any = {
      tenant_id: tenantId,
      qty_available: { $gt: 0 },
      expiry_date: expiryRange[filterStatus],
    };
    if (search) {
      const re = new RegExp(search, "i");
      const matched = await db.collection("products").find({ tenant_id: tenantId, name: re }, { projection: { _id: 1 } }).limit(5000).toArray();
      batchMatch.$or = [{ product_id: { $in: matched.map((p) => p._id.toString()) } }, { batch_number: re }];
    }

    const metricsPipeline = [
      { $match: { tenant_id: tenantId, qty_available: { $gt: 0 }, expiry_date: expiryRange.all } },
      {
        $group: {
          _id: null,
          expired_count: { $sum: { $cond: [{ $lt: ["$expiry_date", todayStr] }, 1, 0] } },
          expired_value: { $sum: { $cond: [{ $lt: ["$expiry_date", todayStr] }, { $multiply: ["$qty_available", { $ifNull: ["$cost_price", 0] }] }, 0] } },
          days30_count: { $sum: { $cond: [{ $and: [{ $gte: ["$expiry_date", todayStr] }, { $lte: ["$expiry_date", plus30Str] }] }, 1, 0] } },
          days60_count: { $sum: { $cond: [{ $and: [{ $gt: ["$expiry_date", plus30Str] }, { $lte: ["$expiry_date", plus60Str] }] }, 1, 0] } },
          days90_count: { $sum: { $cond: [{ $and: [{ $gt: ["$expiry_date", plus60Str] }, { $lte: ["$expiry_date", plus90Str] }] }, 1, 0] } },
        },
      },
    ];

    // Sort + paginate on the batch itself, then join only the rows being returned
    const tablePipeline = [
      { $match: batchMatch },
      { $sort: { expiry_date: 1, _id: 1 } },
      ...(isExport ? [{ $limit: MAX_EXPORT_ROWS }] : [{ $skip: skip }, { $limit: limit }]),
      ...productLookupStages(tenantId, "$product_id", ["name"]),
      { $addFields: { _supp: { $convert: { input: "$supplier_id", to: "objectId", onError: null, onNull: null } } } },
      {
        $lookup: {
          from: "suppliers",
          localField: "_supp",
          foreignField: "_id",
          pipeline: [{ $match: { tenant_id: tenantId } }, { $project: { name: 1 } }],
          as: "supplier_doc",
        },
      },
      { $unwind: { path: "$supplier_doc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          product_name: { $ifNull: ["$product.name", "Unknown"] },
          batch_number: 1,
          qty_available: 1,
          expiry_date: 1,
          cost_price: 1,
          supplier_name: { $ifNull: ["$supplier_doc.name", { $ifNull: ["$supplier", "-"] }] },
          purchase_value_loss: { $multiply: ["$qty_available", { $ifNull: ["$cost_price", 0] }] },
          status: {
            $cond: [
              { $lt: ["$expiry_date", todayStr] }, "Expired",
              { $cond: [{ $lte: ["$expiry_date", plus30Str] }, "30 Days", { $cond: [{ $lte: ["$expiry_date", plus60Str] }, "60 Days", "90 Days"] }] },
            ],
          },
        },
      },
    ];

    const [metricsResult, items, totalItemsCount] = await Promise.all([
      db.collection("batches").aggregate(metricsPipeline).toArray(),
      db.collection("batches").aggregate(tablePipeline).toArray(),
      isExport ? Promise.resolve(-1) : db.collection("batches").countDocuments(batchMatch),
    ]);
    const metrics = metricsResult[0] || { expired_count: 0, expired_value: 0, days30_count: 0, days60_count: 0, days90_count: 0 };
    metrics.expired_value = round2(metrics.expired_value);
    const total = totalItemsCount < 0 ? items.length : totalItemsCount;

    return NextResponse.json({
      metrics,
      table: {
        data: items.map((r: any) => ({ ...r, purchase_value_loss: round2(r.purchase_value_loss) })),
        pagination: paginationMeta(total, page, limit),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/reports/expiry");
  }
}
