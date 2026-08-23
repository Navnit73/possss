import { NextResponse } from "next/server";
import { auth } from "@/auth";
import client from "@/lib/mongodb";
import { headers } from "next/headers";

export type AuditContext = {
  setBefore: (data: any) => void;
  setAfter: (data: any) => void;
  setAction: (action: string) => void;
  setModule: (module: string) => void;
  setCustomTenantId: (tenantId: string) => void;
  setCustomUserId: (userId: string) => void;
};

export function withAuditLog(
  defaultAction: string,
  defaultModule: string,
  handler: (req: Request, context: any, audit: AuditContext) => Promise<NextResponse>
) {
  return async (req: Request, context: any) => {
    let beforeState = null;
    let afterState = null;
    let action = defaultAction;
    let auditModule = defaultModule;
    let customTenantId: string | null = null;
    let customUserId: string | null = null;

    const audit: AuditContext = {
      setBefore: (data) => { beforeState = data; },
      setAfter: (data) => { afterState = data; },
      setAction: (a) => { action = a; },
      setModule: (m) => { auditModule = m; },
      setCustomTenantId: (t) => { customTenantId = t; },
      setCustomUserId: (u) => { customUserId = u; },
    };

    try {
      const response = await handler(req, context, audit);
      
      // If successful (2xx), log it
      if (response.status >= 200 && response.status < 300) {
        // Safe auth check, won't crash if unauthenticated
        const session = await auth().catch(() => null);
        
        const tenantId = customTenantId || (session?.user as any)?.tenant_id;
        const userId = customUserId || session?.user?.id;
        
        if (tenantId) {
          const headersList = await headers();
          const rawIp = headersList.get("x-forwarded-for") || req.headers.get("x-forwarded-for") || "127.0.0.1";
          const ip = rawIp.split(",")[0].trim();
          const browser = headersList.get("user-agent") || req.headers.get("user-agent") || "Unknown Browser";
          
          const logEntry = {
            user_id: userId,
            tenant_id: tenantId,
            action,
            module: auditModule,
            before: beforeState,
            after: afterState,
            ip,
            browser,
            timestamp: new Date()
          };
          
          await client.db("pos").collection("audit_logs").insertOne(logEntry);
        }
      }
      return response;
    } catch (error: any) {
       throw error;
    }
  }
}

export async function logAuditDirectly(entry: {
  tenantId: string;
  userId?: string;
  action: string;
  module: string;
  ip?: string;
  browser?: string;
  before?: any;
  after?: any;
}) {
  try {
    const logEntry = {
      user_id: entry.userId,
      tenant_id: entry.tenantId,
      action: entry.action,
      module: entry.module,
      before: entry.before,
      after: entry.after,
      ip: entry.ip || "System",
      browser: entry.browser || "System",
      timestamp: new Date()
    };
    await client.db("pos").collection("audit_logs").insertOne(logEntry);
  } catch (error) {
    console.error("Failed to log audit directly:", error);
  }
}
