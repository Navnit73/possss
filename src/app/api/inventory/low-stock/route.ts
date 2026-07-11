import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    // Aggregate products and sum up their batch quantities
    const lowStockItems = await db.collection("products").aggregate([
      { $match: { tenant_id: tenantId, status: "ACTIVE" } },
      {
        $lookup: {
          from: "batches",
          let: { productId: { $toString: "$_id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$product_id", "$$productId"] } } }
          ],
          as: "batches"
        }
      },
      {
        $addFields: {
          total_stock: { $sum: "$batches.qty_available" }
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
