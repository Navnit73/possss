import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { createStoreSchema, businessDetailsSchema, subscriptionSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { business_name } = createStoreSchema.parse(body);

    const db = client.db("pos");
    
    // Create new tenant
    const newTenant = {
      business_name,
      status: "PENDING",
      created_at: new Date(),
    };

    const result = await db.collection("tenants").insertOne(newTenant);
    
    // Link tenant to user
    await db.collection("users").updateOne(
      { _id: new ObjectId(session.user.id) },
      { $set: { tenant_id: result.insertedId.toString() } }
    );

    return NextResponse.json({ tenant_id: result.insertedId, message: "Store created" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { step, data } = body;

    const db = client.db("pos");
    const user = await db.collection("users").findOne({ _id: new ObjectId(session.user.id) });

    if (!user || !user.tenant_id) {
      return NextResponse.json({ error: "No active store found" }, { status: 404 });
    }

    let updateData = {};

    if (step === "business-details") {
      const validated = businessDetailsSchema.parse(data);
      updateData = { ...validated };
    } else if (step === "subscription") {
      const validated = subscriptionSchema.parse(data);
      updateData = { ...validated, status: "ACTIVE" };
    } else {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    await db.collection("tenants").updateOne(
      { _id: new ObjectId(user.tenant_id) },
      { $set: updateData }
    );

    return NextResponse.json({ message: "Store updated successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
