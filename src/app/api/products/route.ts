import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";
import { logAction } from "@/lib/logger";
import { withAuditLog, AuditContext } from "@/lib/auditLogger";
import { escapeRegExp } from "@/lib/utils";

const MAX_PAGE_SIZE = 200;
const MAX_SEARCH_TOKENS = 6;

export async function GET(req: Request) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "VIEW");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");

    // Pagination is opt-in (?limit=&offset=&q=) so callers that need the full catalog (e.g. Add Stock) still get a plain array.
    const params = new URL(req.url).searchParams;
    const paginated = params.has("limit");
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "100", 10) || 100, 1), MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);
    const query = (params.get("q") || "").trim().slice(0, 100);

    // Every word must match somewhere ("para 500" finds "Paracetamol 500mg")
    const match: Record<string, any> = { tenant_id: tenantId };
    if (query) {
      match.$and = query.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS).map((token) => {
        const re = { $regex: escapeRegExp(token), $options: "i" };
        return { $or: [{ name: re }, { generic_name: re }, { brand: re }, { barcode: re }, { sku: re }] };
      });
    }

    // Page first, then join — so the lookups only run for the rows actually returned
    const pageStages = paginated
      ? [{ $sort: { name: 1, _id: 1 } }, { $skip: offset }, { $limit: limit }]
      : [];

    // Aggregation to join category and manufacturer names
    const productsPromise = db.collection("products").aggregate([
      { $match: match },
      ...pageStages,
      {
        $addFields: {
          category_obj_id: { 
            $convert: { input: "$category_id", to: "objectId", onError: null, onNull: null } 
          },
          manufacturer_obj_id: { 
            $convert: { input: "$manufacturer_id", to: "objectId", onError: null, onNull: null } 
          }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "category_obj_id",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "manufacturer_obj_id",
          foreignField: "_id",
          as: "manufacturer"
        }
      },
      {
        $unwind: { path: "$category", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: "$manufacturer", preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          id_string: { $toString: "$_id" }
        }
      },
      {
        // Equality join (localField/foreignField + tenant match) so the {tenant_id, product_id}
        // batches index is used instead of an $expr scan per product
        $lookup: {
          from: "batches",
          localField: "id_string",
          foreignField: "product_id",
          pipeline: [
            { $match: { tenant_id: tenantId } },
            { $group: { _id: null, total_stock: { $sum: "$qty_available" } } }
          ],
          as: "stock"
        }
      },
      {
        $addFields: {
          total_stock: { $ifNull: [{ $arrayElemAt: ["$stock.total_stock", 0] }, 0] }
        }
      },
      {
        $project: {
          stock: 0,
          id_string: 0
        }
      }
    ]).toArray();

    if (!paginated) return NextResponse.json(await productsPromise);

    const [items, total] = await Promise.all([productsPromise, db.collection("products").countDocuments(match)]);
    return NextResponse.json({ items, total, offset, limit, hasMore: offset + items.length < total });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/products");
  }
}

export const POST = withAuditLog("CREATE_PRODUCT", "PRODUCTS", async (req: Request, context: any, audit: AuditContext) => {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "CREATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    // Normalise the barcode so " 123" and "123" can't both exist
    if (body && typeof body.barcode === "string") body.barcode = body.barcode.trim();
    const validatedData = productSchema.parse(body);

    const db = client.db("pos");
    
    // Validate category belongs to tenant
    const category = await db.collection("categories").findOne({
      _id: new ObjectId(validatedData.category_id),
      tenant_id: tenantId
    });
    if (!category) {
      return NextResponse.json({ error: "Invalid category selected" }, { status: 400 });
    }

    // Validate manufacturer belongs to tenant
    const manufacturer = await db.collection("manufacturers").findOne({
      _id: new ObjectId(validatedData.manufacturer_id),
      tenant_id: tenantId
    });
    if (!manufacturer) {
      return NextResponse.json({ error: "Invalid manufacturer selected" }, { status: 400 });
    }
    
    // Validate barcode uniqueness if provided
    if (validatedData.barcode) {
      const existing = await db.collection("products").findOne({ 
        tenant_id: tenantId, 
        barcode: validatedData.barcode 
      });
      if (existing) {
        return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 400 });
      }
    }

    const newProduct = {
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const result = await db.collection("products").insertOne(newProduct);

    audit.setAfter({ _id: result.insertedId, ...newProduct });

    return NextResponse.json({ _id: result.insertedId, message: "Product created successfully" }, { status: 201 });
  } catch (error: any) {
    // Unique {tenant_id, barcode} index caught a concurrent duplicate
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A product with this barcode already exists" }, { status: 409 });
    }
    return await handleApiError(error, "POST /api/products");
  }
});
