import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { categorySchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const categories = await db.collection("categories").find({ tenant_id: tenantId }).toArray();
    
    return NextResponse.json(categories);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/categories");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = categorySchema.parse(body);

    const db = client.db("pos");
    
    // Check uniqueness
    const existing = await db.collection("categories").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${validatedData.name}$`, "i") } // Case-insensitive check
    });
    
    if (existing) {
      return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    }

    const result = await db.collection("categories").insertOne({
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    });

    return NextResponse.json({ _id: result.insertedId, message: "Category created" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/categories");
  }
}
