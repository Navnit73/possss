import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { checkPermission } from "@/lib/rbac";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json({ error: "Invalid supplier ID" }, { status: 400 });
    }

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
            { supplier_id: id } // set on batches received since supplier ids are stored
          ]
        } 
      },
      // Sort + cap before the join so only the rows we return are looked up
      { $sort: { created_at: -1 } },
      { $limit: 1000 },
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
          pipeline: [{ $project: { name: 1, strength: 1 } }],
          as: "product"
        }
      },
      {
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
      },
      { $project: { product_obj_id: 0 } }
    ]).toArray();

    return NextResponse.json(batches);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/suppliers/[id]/history");
  }
}
