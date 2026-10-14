import { NextResponse, after } from "next/server";
import bcrypt from "bcryptjs";
import client from "@/lib/mongodb";
import { registerSchema } from "@/lib/validations";
import { sendWelcomeEmail } from "@/lib/mail";
import { logAction } from "@/lib/logger";
import { handleApiError } from "@/lib/errorHandler";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // Rate limit: 5 requests per minute per IP
    const ip = getClientIp(req);
    if (!(await rateLimit(`register-${ip}`, 5, 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const validatedData = registerSchema.parse(body);
    const email = validatedData.email.trim().toLowerCase();

    const db = client.db("pos");
    
    // Check if user exists
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user
    const newUser = {
      name: validatedData.name,
      email,
      password: hashedPassword,
      role: "OWNER",
      created_at: new Date(),
    };

    let result;
    try {
      result = await db.collection("users").insertOne(newUser);
    } catch (insertError: any) {
      // Two concurrent sign-ups with the same email both pass the findOne check; the unique index catches the second.
      if (insertError?.code === 11000) {
        return NextResponse.json({ error: "User already exists" }, { status: 400 });
      }
      throw insertError;
    }

    const userId = result.insertedId.toString();
    // Audit log + welcome email run after the response is sent so they don't slow sign-up
    // (and the email isn't dropped when the function instance is frozen).
    after(async () => {
      await logAction({
        action: "USER_REGISTERED",
        userId,
        details: { email: newUser.email, role: newUser.role }
      });
      await sendWelcomeEmail(newUser.email, newUser.name);
    });

    return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
  } catch (error: any) {
    console.error("Registration error:", error);
    return await handleApiError(error, "/api/auth/register");
  }
}
