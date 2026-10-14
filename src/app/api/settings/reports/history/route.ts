import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEmailHistory } from "@/lib/emailLog";
import { handleApiError } from "@/lib/errorHandler";
import { checkReportSettingsAccess } from "@/lib/reports/settingsAccess";

export async function GET() {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessError = checkReportSettingsAccess(session, "VIEW");
    if (accessError) return accessError;

    const history = await getEmailHistory(tenantId);
    return NextResponse.json({ history });
  } catch (error) {
    return handleApiError(error, "GET /api/settings/reports/history");
  }
}
