import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { profileUpdateSchema } from "@/lib/validations";
import { ObjectId } from "mongodb";
import { handleApiError } from "@/lib/errorHandler";
import { logAuditDirectly } from "@/lib/auditLogger";
import { headers } from "next/headers";
import { z } from "zod";

function toObjectId(id: any): ObjectId | null {
  if (!id) return null;
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userObjId = toObjectId(userId);
    if (!userObjId) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const db = client.db("pos");
    const user = await db.collection("users").findOne(
      { _id: userObjId },
      { projection: { password: 0, resetToken: 0, resetTokenExpiry: 0 } }
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let tenant = null;
    const tenantObjId = toObjectId(user.tenant_id);
    if (tenantObjId) {
      tenant = await db.collection("tenants").findOne({ _id: tenantObjId });
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

    const userObjId = toObjectId(userId);
    if (!userObjId) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

    const body = await req.json();
    
    const db = client.db("pos");
    const userDb = await db.collection("users").findOne({ _id: userObjId });

    if (!userDb) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "Unknown IP";
    const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";

    if (body.user) {
      const validatedUser = profileUpdateSchema.parse(body.user);
      await db.collection("users").updateOne(
        { _id: userObjId },
        { $set: { ...validatedUser, updated_at: new Date() } }
      );

      // Audit Log for user profile
      if (userDb.tenant_id) {
        await logAuditDirectly({
          tenantId: userDb.tenant_id,
          userId,
          action: "PROFILE_UPDATED",
          module: "ACCOUNT",
          ip,
          browser,
          before: { name: userDb.name, phone: userDb.phone, job_title: userDb.job_title },
          after: validatedUser
        });
      }
    }

    let updatedTenant = null;
    const isOwner = (session?.user as any)?.role === "OWNER" || userDb.role === "OWNER";
    const tenantObjId = toObjectId(userDb.tenant_id);

    if (body.tenant && tenantObjId) {
      if (!isOwner) {
        return NextResponse.json({ error: "Forbidden: Only store owners can update business details" }, { status: 403 });
      }

      const businessSchema = z.object({
        business_name: z.string().min(2, "Business name is required"),
        country: z.string().optional(),
        currency: z.string().optional(),
        timezone: z.string().optional(),
        address: z.string().optional(),
      });
      const validatedTenant = businessSchema.parse(body.tenant);
      
      const oldTenant = await db.collection("tenants").findOne({ _id: tenantObjId });

      await db.collection("tenants").updateOne(
        { _id: tenantObjId },
        { $set: { ...validatedTenant, updated_at: new Date() } }
      );
      updatedTenant = await db.collection("tenants").findOne({ _id: tenantObjId });

      // Audit Log for tenant details
      await logAuditDirectly({
        tenantId: userDb.tenant_id,
        userId,
        action: "BUSINESS_DETAILS_UPDATED",
        module: "SETTINGS",
        ip,
        browser,
        before: oldTenant ? { business_name: oldTenant.business_name, currency: oldTenant.currency, country: oldTenant.country } : null,
        after: validatedTenant
      });
    }

    return NextResponse.json({ message: "Profile updated successfully", tenant: updatedTenant }, { status: 200 });
  } catch (error: any) {
    return await handleApiError(error, "PUT /api/account/profile");
  }
}

