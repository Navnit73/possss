import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "./lib/mongodb"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { authConfig } from "./auth.config"

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = client.db("pos");
        const user = await db.collection("users").findOne({ email: credentials.email });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(credentials.password as string, user.password);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        let tenantStatus = null;
        if (user.tenant_id) {
          const tenant = await db.collection("tenants").findOne({ _id: new ObjectId(user.tenant_id) });
          if (tenant) {
            tenantStatus = tenant.status;
          }
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
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
        token.tenant_id = (user as any).tenant_id;
        token.tenant_status = (user as any).tenant_status;
      }
      
      // Securely fetch updated status from DB when update() is called
      if (trigger === "update") {
        const db = client.db("pos");
        const userDb = await db.collection("users").findOne({ _id: new ObjectId(token.id as string) });
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
        (session.user as any).tenant_id = token.tenant_id;
        (session.user as any).tenant_status = token.tenant_status;
      }
      return session;
    }
  },
})
