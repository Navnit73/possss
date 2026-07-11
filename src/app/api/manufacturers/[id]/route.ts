import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { manufacturerSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { ObjectId } from "mongodb";
import { checkPermission } from "@/lib/rbac";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const permError = checkPermission(session, "PRODUCTS", "UPDATE");
    if (permError) return permError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await props.params;
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid manufacturer ID" }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = manufacturerSchema.parse(body);

    const db = client.db("pos");
    
    // Check uniqueness, excluding the current manufacturer
    const existing = await db.collection("manufacturers").findOne({
      tenant_id: tenantId,
      name: { $regex: new RegExp(`^${validatedData.name}$`, "i") },
      _id: { $ne: new ObjectId(id) }
    });
    
    if (existing) {
      return NextResponse.json({ error: "Manufacturer with this name already exists" }, { status: 400 });
    }

    const result = await db.collection("manufacturers").updateOne(
      { _id: new ObjectId(id), tenant_id: tenantId },
      { 
        $set: {
          ...validatedData,
          updated_at: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Manufacturer not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Manufacturer updated" });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/manufacturers/[id]");
  }
}
