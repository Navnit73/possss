import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const db = client.db("pos");
    const supplier = await db.collection("suppliers").findOne({ 
      _id: new ObjectId(id),
      tenant_id: tenantId 
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // We fetch batches where the supplier field matches this supplier's ID or Name
    const batches = await db.collection("batches").aggregate([
      { 
        $match: { 
          tenant_id: tenantId,
          $or: [
            { supplier: id },
            { supplier: supplier.name },
            { supplier_id: id } // in case we update batch schema later
          ]
        } 
      },
      {
        $addFields: {
          product_obj_id: { 
            $convert: { input: "$product_id", to: "objectId", onError: null, onNull: null } 
          }
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
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
      },
      {
        $sort: { created_at: -1 }
      }
    ]).toArray();

    return NextResponse.json(batches);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/suppliers/[id]/history");
  }
}
