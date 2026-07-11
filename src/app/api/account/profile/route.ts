import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { profileUpdateSchema, businessDetailsSchema, createStoreSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let tenant = null;
    if (user.tenant_id) {
      tenant = await db.collection("tenants").findOne({ _id: new ObjectId(user.tenant_id) });
    }

    return NextResponse.json({ user, tenant }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, "GET /api/account/profile");
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    
    // We will separate the body into user data and tenant data
    // Assuming the client sends `{ user: { ... }, tenant: { ... } }`
    
    const db = client.db("pos");
    const userDb = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!userDb) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (body.user) {
      const validatedUser = profileUpdateSchema.parse(body.user);
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: { ...validatedUser, updated_at: new Date() } }
      );
    }

    if (body.tenant && userDb.tenant_id && (session?.user as any)?.role === "OWNER") {
      // Only owner can update business details from profile
      const businessSchema = z.object({
        business_name: z.string().min(2, "Business name is required"),
        country: z.string().optional(),
        currency: z.string().optional(),
        timezone: z.string().optional(),
        address: z.string().optional(),
      });
      const validatedTenant = businessSchema.parse(body.tenant);
      
      await db.collection("tenants").updateOne(
        { _id: new ObjectId(userDb.tenant_id) },
        { $set: { ...validatedTenant, updated_at: new Date() } }
      );
    }

    // Log the activity
    await db.collection("logs").insertOne({
      tenantId: userDb.tenant_id,
      userId: userId,
      action: "PROFILE_UPDATED",
      details: {
        message: "User updated their account profile",
        updatedFields: Object.keys(body.user || {}).concat(Object.keys(body.tenant || {}))
      },
      timestamp: new Date()
    });

    return NextResponse.json({ message: "Profile updated successfully" }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/account/profile");
  }
}
