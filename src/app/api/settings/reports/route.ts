import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReportSettings, updateReportSettings } from "@/lib/settings";
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

    const settings = await getReportSettings(tenantId);
    return NextResponse.json({ settings: settings || null });
  } catch (error) {
    return handleApiError(error, "GET /api/settings/reports");
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!hasPermissionSync(session, "SETTINGS", "EDIT") && !["OWNER", "MANAGER"].includes((session?.user as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    
    // Basic validation
    if (typeof body.enabled !== 'boolean') throw new Error("Invalid enabled status");
    if (!Array.isArray(body.recipients)) throw new Error("Recipients must be an array");
    if (!body.time) throw new Error("Time is required");
    if (!body.timezone) throw new Error("Timezone is required");
    if (!["DAILY", "WEEKLY", "MONTHLY"].includes(body.frequency)) throw new Error("Invalid frequency");

    await updateReportSettings(tenantId, body);

    return NextResponse.json({ success: true, message: "Settings updated" });
  } catch (error) {
    return handleApiError(error, "PUT /api/settings/reports");
  }
}
