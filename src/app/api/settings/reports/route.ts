import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getReportSettings, updateReportSettings } from "@/lib/settings";
import { handleApiError } from "@/lib/errorHandler";
import { checkReportSettingsAccess } from "@/lib/reports/settingsAccess";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RECIPIENTS = 10;

function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessError = checkReportSettingsAccess(session, "VIEW");
    if (accessError) return accessError;

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

    const accessError = checkReportSettingsAccess(session, "EDIT");
    if (accessError) return accessError;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    // Validate inputs
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: "Invalid enabled status" }, { status: 400 });
    if (!Array.isArray(body.recipients)) return NextResponse.json({ error: "Recipients must be an array" }, { status: 400 });
    if (typeof body.time !== "string" || !TIME_REGEX.test(body.time)) return NextResponse.json({ error: "Time must be in HH:mm format" }, { status: 400 });
    if (!isValidTimezone(body.timezone)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    if (!["DAILY", "WEEKLY", "MONTHLY"].includes(body.frequency)) return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });

    // Validate email recipients (trimmed, de-duplicated case-insensitively, capped)
    const cleanedRecipients: string[] = [...new Map<string, string>(
      body.recipients
        .map((r: any) => (typeof r === "string" ? r.trim() : ""))
        .filter((r: string) => r.length > 0)
        .map((r: string) => [r.toLowerCase(), r] as [string, string])
    ).values()];

    if (cleanedRecipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `You can add at most ${MAX_RECIPIENTS} recipients` }, { status: 400 });
    }
    for (const email of cleanedRecipients) {
      if (email.length > 254 || !EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: `Invalid email recipient address: "${email.slice(0, 254)}"` }, { status: 400 });
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
