import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermissionAny } from "@/lib/rbac";

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    const query = (searchParams.get("q")?.trim() || "").slice(0, 100);

    const db = client.db("pos");

    const productMatchQuery: any = {
      tenant_id: tenantId,
      status: "ACTIVE"
    };

    if (query) {
      const escaped = escapeRegExp(query);
      productMatchQuery.$or = [
        { barcode: query }, // Exact barcode match first
        { sku: query },     // Exact SKU match first
        { name: { $regex: new RegExp(escaped, "i") } },
        { generic_name: { $regex: new RegExp(escaped, "i") } },
        { active_ingredients: { $regex: new RegExp(escaped, "i") } }
      ];
    }

    const products = await db.collection("products").aggregate([
      { $match: productMatchQuery },
      { $limit: 20 },
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
            { $sort: { expiry_date: 1 } }
          ],
          as: "batches"
        }
      }
    ], { maxTimeMS: 3_000 }).toArray();
    
    return NextResponse.json(products);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/pos/search");
  }
}
