import NextAuth from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "./lib/mongodb"
import CredentialsProvider from "next-auth/providers/credentials"
import { CredentialsSignin } from "next-auth"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { rateLimit } from "./lib/rateLimit"
import { logAuditDirectly } from "./lib/auditLogger"
import { after } from "next/server"
import { refreshTokenAccess, resolveAccess } from "./lib/sessionAccess"

// Only `code` reaches the client (signIn() returns it as `res.code`); the message is server-side only.
class CustomAuthError extends CredentialsSignin {
  constructor(code: string, message?: string) {
    super(message);
    this.code = code;
    this.message = message || "Invalid credentials";
  }
}

// Compared against when the user doesn't exist so response time doesn't reveal which emails are registered.
const DUMMY_PASSWORD_HASH = "$2b$12$JUKjv4CknG.mBLY7bLM.SeZrRQv9A9RqVhpnQlxiCOoaZBYu20qam";

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
          throw new CustomAuthError("missing_fields", "Email and password are required");
        }

        // Rate limit by email to prevent brute force (5 attempts per minute)
        const email = String(credentials.email).trim().toLowerCase();
        const identifier = `login-${email}`;
        if (!(await rateLimit(identifier, 5, 60 * 1000))) {
          throw new CustomAuthError("rate_limited", "Too many login attempts. Please try again later.");
        }

        const db = client.db("pos");
        const user = await db.collection("users").findOne({ email });

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user?.password || DUMMY_PASSWORD_HASH
        );

        if (!user || !user.password || !isValid) {
          throw new CustomAuthError("invalid_credentials", "Invalid email or password");
        }

        const access = await resolveAccess(db, user);
        if (access.tenant_status === "DELETED") {
          // Staff of a deleted store must not be able to sign in
          throw new CustomAuthError("invalid_credentials", "Invalid email or password");
        }

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          ...access,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.role_id = (user as any).role_id;
        token.permissions = (user as any).permissions;
        token.tenant_id = (user as any).tenant_id;
        token.tenant_status = (user as any).tenant_status;
        token.subscription_lapsed = (user as any).subscription_lapsed;
        token.checkedAt = Date.now();
        // Sessions that signed in before the user's last password change are ended (see refreshTokenAccess)
        token.authAt = Date.now();
        return token;
      }

      return refreshTokenAccess(token, client.db("pos"), trigger === "update");
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role;
        (session.user as any).role_id = token.role_id;
        (session.user as any).permissions = token.permissions || [];
        (session.user as any).tenant_id = token.tenant_id;
        (session.user as any).tenant_status = token.tenant_status;
        (session.user as any).subscription_lapsed = Boolean(token.subscription_lapsed);
      }
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (user && (user as any).tenant_id) {
        // Don't hold the login response open for an audit write.
        after(() => logAuditDirectly({
          tenantId: (user as any).tenant_id,
          userId: user.id,
          action: "LOGIN",
          module: "AUTH",
        }));
      }
    },
    async signOut(params: any) {
      const token = params.token;
      if (token && (token as any).tenant_id) {
        await logAuditDirectly({
          tenantId: (token as any).tenant_id,
          userId: (token as any).id,
          action: "LOGOUT",
          module: "AUTH",
        });
      }
    }
  }
})
