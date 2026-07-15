import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermissionSync } from "@/lib/rbac";
import { fetchDailyReportData, generateDailyReportPdf } from "@/lib/reports/generateDailyReport";
import { sendDailyReportEmail } from "@/lib/mail";
import { handleApiError } from "@/lib/errorHandler";
import { getReportSettings } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!hasPermissionSync(session, "SETTINGS", "EDIT") && !["OWNER", "MANAGER"].includes((session?.user as any)?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) throw new Error("Email is required for testing");

    const now = new Date();
    const settings = await getReportSettings(tenantId);
    const timezone = settings?.timezone || "UTC";

    const data = await fetchDailyReportData(tenantId, now, timezone);
    const pdfBuffer = await generateDailyReportPdf(data);
    
    await sendDailyReportEmail([email], pdfBuffer, data, timezone);

    return NextResponse.json({ success: true, message: "Test email sent successfully" });
  } catch (error: any) {
    return handleApiError(error, "POST /api/settings/reports/test");
  }
}
