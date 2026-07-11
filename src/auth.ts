import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "./lib/mongodb"
import CredentialsProvider from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { authConfig } from "./auth.config"
import { rateLimit } from "./lib/rateLimit"

class CustomAuthError extends CredentialsSignin {
  code = "custom_error";
  constructor(message?: string) {
    super(message);
    this.message = message || "Invalid credentials";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: MongoDBAdapter(client),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new CustomAuthError("Email and password are required");
        }

        // Rate limit by email to prevent brute force (5 attempts per minute)
        const identifier = `login-${credentials.email}`;
        if (!rateLimit(identifier, 5, 60 * 1000)) {
          throw new CustomAuthError("Too many login attempts. Please try again later.");
        }

        const db = client.db("pos");
        const user = await db.collection("users").findOne({ email: credentials.email });

        if (!user || !user.password) {
          throw new CustomAuthError("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isValid) {
          throw new CustomAuthError("Invalid email or password");
        }

        let tenantStatus = null;
        if (user.tenant_id) {
          const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(user.tenant_id) });
          if (tenant) {
            tenantStatus = tenant.status;
          }
        }

        let permissions: { module: string, action: string }[] = [];
        if (user.role_id) {
          const customRole = await db.collection("roles").findOne({ _id: new ObjectId(user.role_id) });
          if (customRole && customRole.permissions) {
            permissions = customRole.permissions;
          }
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          role_id: user.role_id || null,
          permissions: permissions,
          tenant_id: user.tenant_id || null,
          tenant_status: tenantStatus,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.role_id = (user as any).role_id;
        token.permissions = (user as any).permissions;
        token.tenant_id = (user as any).tenant_id;
        token.tenant_status = (user as any).tenant_status;
      }
      
      // Securely fetch updated status from DB when update() is called
      if (trigger === "update") {
        const db = client.db("pos");
        const userDb = await db.collection("users").findOne({ _id: new ObjectId(token.id as string) });
        if (userDb) {
          token.role = userDb.role;
          token.role_id = userDb.role_id?.toString() || null;
          
          if (userDb.role_id) {
            const customRole = await db.collection("roles").findOne({ _id: new ObjectId(userDb.role_id) });
            if (customRole && customRole.permissions) {
              token.permissions = customRole.permissions;
            }
          }
        }
        
        if (userDb && userDb.tenant_id) {
          token.tenant_id = userDb.tenant_id;
          const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(userDb.tenant_id) });
          if (tenant) {
            token.tenant_status = tenant.status;
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role;
        (session.user as any).role_id = token.role_id;
        (session.user as any).permissions = token.permissions || [];
        (session.user as any).tenant_id = token.tenant_id;
        (session.user as any).tenant_status = token.tenant_status;
      }
      return session;
    }
  },
})
