import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { supplierSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const suppliers = await db.collection("suppliers").find({ tenant_id: tenantId }).toArray();
    
    return NextResponse.json(suppliers);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/suppliers");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    
    // empty email from UI might come as empty string, map to undefined for Zod if we want, 
    // but the schema `.or(z.literal(""))` handles it.
    const validatedData = supplierSchema.parse(body);

    const db = client.db("pos");
    
    const existing = await db.collection("suppliers").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${validatedData.name}$`, "i") }
    });
    
    if (existing) {
      return NextResponse.json({ error: "Supplier with this name already exists" }, { status: 400 });
    }

    const result = await db.collection("suppliers").insertOne({
      ...validatedData,
      tenant_id: tenantId,
      created_at: new Date(),
    });

    return NextResponse.json({ _id: result.insertedId, message: "Supplier created" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/suppliers");
  }
}
