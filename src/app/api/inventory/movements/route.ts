import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    
    const movements = await db.collection("stock_movements").aggregate([
      { $match: { tenant_id: tenantId } },
      {
        $addFields: {
          product_obj_id: { $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } },
          batch_obj_id: { $convert: { input: "$batch_id", to: "objectId", onError: null, onNull: null } },
          user_obj_id: { $convert: { input: "$created_by", to: "objectId", onError: null, onNull: null } }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "product_obj_id",
          foreignField: "_id",
          as: "product"
        }
      },
      {
        $lookup: {
          from: "batches",
          localField: "batch_obj_id",
          foreignField: "_id",
          as: "batch"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "user_obj_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: "$batch", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { created_at: -1 }
      }
    ]).toArray();
    
    return NextResponse.json(movements);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/inventory/movements");
  }
}
