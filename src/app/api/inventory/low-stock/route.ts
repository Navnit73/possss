import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { getStoreToday } from "@/lib/storeTime";
import { escapeRegExp } from "@/lib/utils";

const MAX_PAGE_SIZE = 200;
const MAX_SEARCH_TOKENS = 6;

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");

    // Pagination is opt-in (?limit=&offset=) so a caller without it still gets the full array
    const params = new URL(req.url).searchParams;
    const paginated = params.has("limit");
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "100", 10) || 100, 1), MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);
    const query = (params.get("q") || "").trim().slice(0, 100);

    // Every word must match somewhere ("para 500" finds "Paracetamol 500mg")
    const searchStages = query
      ? [{
          $match: {
            $and: query.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS).map((token) => {
              const re = { $regex: escapeRegExp(token), $options: "i" };
              return { $or: [{ name: re }, { generic_name: re }, { sku: re }, { strength: re }] };
            }),
          },
        }]
      : [];

    // Expired batches can't be sold, so they must not count towards available stock.
    const today = await getStoreToday(db, tenantId);
    
    // Aggregate products and sum up their sellable (in-stock, non-expired) batch quantities
    const lowStockItems = await db.collection("products").aggregate([
      { $match: { tenant_id: tenantId, status: "ACTIVE" } },
      { $addFields: { id_string: { $toString: "$_id" } } },
      {
        // Equality join on product_id + tenant_id so the {tenant_id, product_id} index is used,
        // and the sum is computed inside the lookup instead of materialising every batch.
        $lookup: {
          from: "batches",
          localField: "id_string",
          foreignField: "product_id",
          pipeline: [
            {
              $match: {
                tenant_id: tenantId,
                qty_available: { $gt: 0 },
                $or: [
                  { expiry_date: { $exists: false } },
                  { expiry_date: null },
                  { expiry_date: "" },
                  { expiry_date: { $gte: today } }
                ]
              }
            },
            { $group: { _id: null, total: { $sum: "$qty_available" } } }
          ],
          as: "stock"
        }
      },
      {
        $addFields: {
          total_stock: { $ifNull: [{ $arrayElemAt: ["$stock.total", 0] }, 0] }
        }
      },
      {
        $match: {
          $expr: { $lte: ["$total_stock", { $ifNull: ["$minimum_stock", 0] }] }
        }
      },
      {
        $project: {
          name: 1,
          strength: 1,
          sku: 1,
          minimum_stock: 1,
          total_stock: 1,
          rack_number: 1,
          category_id: 1,
          generic_name: 1,
        }
      },
      {
        // name + _id tie-breakers keep the order stable so pages don't overlap or skip rows
        $sort: { total_stock: 1, name: 1, _id: 1 }
      },
      // Low stock is only known after the stock join, so the page, its total and the
      // (search-independent) summary are all taken in one pass here
      ...(paginated
        ? [{
            $facet: {
              items: [...searchStages, { $skip: offset }, { $limit: limit }],
              count: [...searchStages, { $count: "total" }],
              summary: [{
                $group: {
                  _id: null,
                  low_stock: { $sum: 1 },
                  out_of_stock: { $sum: { $cond: [{ $lte: ["$total_stock", 0] }, 1, 0] } },
                  units_short: { $sum: { $max: [{ $subtract: [{ $ifNull: ["$minimum_stock", 0] }, "$total_stock"] }, 0] } },
                },
              }, { $project: { _id: 0 } }],
            },
          }]
        : [])
    ]).toArray();

    if (!paginated) return NextResponse.json(lowStockItems);

    const facet = lowStockItems[0] ?? {};
    const items = facet.items ?? [];
    const total = facet.count?.[0]?.total ?? 0;
    const summary = facet.summary?.[0] ?? { low_stock: 0, out_of_stock: 0, units_short: 0 };
    return NextResponse.json({ items, total, offset, limit, hasMore: offset + items.length < total, summary });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/low-stock");
  }
}
