import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermissionSync } from "@/lib/rbac";
import { fetchDailyReportData, generateDailyReportPdf } from "@/lib/reports/generateDailyReport";
import { sendDailyReportEmail } from "@/lib/mail";
import { handleApiError } from "@/lib/errorHandler";
import { getReportSettings } from "@/lib/settings";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!hasPermissionSync(session, "SETTINGS", "EDIT") && !["OWNER", "MANAGER"].includes((session?.user as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: "Please provide a valid recipient email address" }, { status: 400 });
    }

    const now = new Date();
    const settings = await getReportSettings(tenantId);
    const timezone = settings?.timezone || "UTC";

    const data = await fetchDailyReportData(tenantId, now, timezone);
    const pdfBuffer = await generateDailyReportPdf(data);
    
    await sendDailyReportEmail([email.trim()], pdfBuffer, data, timezone);

    return NextResponse.json({ success: true, message: `Test report email dispatched to ${email.trim()}` });
  } catch (error: any) {
    return handleApiError(error, "POST /api/settings/reports/test");
  }
}
