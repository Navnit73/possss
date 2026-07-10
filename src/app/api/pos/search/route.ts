import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const db = client.db("pos");

    // We will search products by name, generic_name, barcode, or sku.
    const productMatchQuery: any = {
      tenant_id: tenantId,
      status: "ACTIVE"
    };

    if (query) {
      productMatchQuery.$or = [
        { name: { $regex: new RegExp(query, "i") } },
        { generic_name: { $regex: new RegExp(query, "i") } },
        { active_ingredients: { $regex: new RegExp(query, "i") } },
        { barcode: { $regex: new RegExp(`^${query}$`, "i") } }, 
        { sku: { $regex: new RegExp(`^${query}$`, "i") } }
      ];
    }

    const products = await db.collection("products").aggregate([
      { $match: productMatchQuery },
      {
        $addFields: {
          product_id_str: { $toString: "$_id" }
        }
      },
      // Lookup available batches for these products
      {
        $lookup: {
          from: "batches",
          let: { pid: "$product_id_str" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$tenant_id", tenantId] },
                    { $eq: ["$product_id", "$$pid"] },
                    { $gt: ["$qty_available", 0] }
                  ]
                }
              }
            },
            // Sort by expiry_date nearest first
            { $sort: { expiry_date: 1 } }
          ],
          as: "batches"
        }
      },
      // Removing the out of stock filter so all matching products are shown in search
      // which prevents confusion when a user searches for an existing product with 0 stock.
      {
        $limit: 20
      }
    ]).toArray();
    
    return NextResponse.json(products);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/search");
  }
}
