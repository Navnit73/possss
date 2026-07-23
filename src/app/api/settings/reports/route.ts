import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReportSettings, updateReportSettings } from "@/lib/settings";
import { hasPermissionSync } from "@/lib/rbac";
import { handleApiError } from "@/lib/errorHandler";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    
    // Validate inputs
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: "Invalid enabled status" }, { status: 400 });
    if (!Array.isArray(body.recipients)) return NextResponse.json({ error: "Recipients must be an array" }, { status: 400 });
    if (!body.time) return NextResponse.json({ error: "Time is required" }, { status: 400 });
    if (!body.timezone) return NextResponse.json({ error: "Timezone is required" }, { status: 400 });
    if (!["DAILY", "WEEKLY", "MONTHLY"].includes(body.frequency)) return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });

    // Validate email recipients
    const cleanedRecipients = body.recipients
      .map((r: any) => String(r || "").trim())
      .filter((r: string) => r.length > 0);

    for (const email of cleanedRecipients) {
      if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: `Invalid email recipient address: "${email}"` }, { status: 400 });
      }
    }

    if (body.enabled && cleanedRecipients.length === 0) {
      return NextResponse.json({ error: "At least one valid recipient is required when automated reports are enabled" }, { status: 400 });
    }

    await updateReportSettings(tenantId, {
      enabled: body.enabled,
      recipients: cleanedRecipients,
      time: body.time,
      timezone: body.timezone,
      frequency: body.frequency,
    });

    return NextResponse.json({ success: true, message: "Report settings updated successfully" });
  } catch (error) {
    return handleApiError(error, "PUT /api/settings/reports");
  }
}
