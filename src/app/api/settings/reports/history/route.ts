import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEmailHistory } from "@/lib/emailLog";
import { hasPermissionSync } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!hasPermissionSync(session, "SETTINGS", "VIEW") && !["OWNER", "MANAGER"].includes((session?.user as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = await getEmailHistory(tenantId);
    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error, "GET /api/settings/reports/history");
  }
}
