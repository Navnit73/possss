import { NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { createUserSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/errorHandler";
import { checkRole } from "@/lib/rbac";
import { logAction } from "@/lib/logger";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = client.db("pos");
    const users = await db.collection("users").find(
      { tenant_id: tenantId },
      { projection: { password: 0 } } // exclude password
    ).toArray();

    return NextResponse.json(users);
  } catch (error: any) {
    return await handleApiError(error, "GET /api/users");
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const roleError = checkRole(session, ["OWNER", "MANAGER"]);
    if (roleError) return roleError;

    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validatedData = createUserSchema.parse(body);

    const db = client.db("pos");
    
    // Check if role exists
    const { ObjectId } = require("mongodb");
    const role = await db.collection("roles").findOne({ _id: new ObjectId(validatedData.role_id), tenant_id: tenantId });
    if (!role) {
      return NextResponse.json({ error: "Invalid role selected" }, { status: 400 });
    }

    // Check if user exists across all tenants (emails must be unique)
    const existingUser = await db.collection("users").findOne({ email: validatedData.email });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists with this email" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const newUser = {
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: "CUSTOM",
      role_id: role._id.toString(),
      tenant_id: tenantId,
      created_at: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);

    await logAction({
      action: "STAFF_USER_CREATED",
      userId: (session?.user as any)?.id,
      details: { createdUserId: result.insertedId.toString(), email: newUser.email, role_id: newUser.role_id }
    });

    return NextResponse.json({ message: "User created successfully" }, { status: 201 });
  } catch (error: any) {
    return await handleApiError(error, "POST /api/users");
  }
}
