import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";
import { getStoreToday } from "@/lib/storeTime";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "INVENTORY", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
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
        }
      },
      {
        $sort: { total_stock: 1 }
      }
    ]).toArray();
    
    return NextResponse.json(lowStockItems);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/low-stock");
  }
}
