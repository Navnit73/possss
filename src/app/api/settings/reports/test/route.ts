import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchDailyReportData, generateDailyReportPdf } from "@/lib/reports/generateDailyReport";
import { sendDailyReportEmail } from "@/lib/mail";
import { handleApiError } from "@/lib/errorHandler";
import { getReportSettings } from "@/lib/settings";
import { finishEmailAttempt, startEmailAttempt } from "@/lib/emailLog";
import { rateLimit } from "@/lib/rateLimit";
import { checkReportSettingsAccess } from "@/lib/reports/settingsAccess";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEST_SENDS_PER_HOUR = 5;

export async function POST(req: Request) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accessError = checkReportSettingsAccess(session, "EDIT");
    if (accessError) return accessError;

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Please provide a valid recipient email address" }, { status: 400 });
    }

    // Only to an address already saved as a recipient, so this can't be used to mail store data anywhere
    const settings = await getReportSettings(tenantId);
    const saved = (settings?.recipients ?? []).map((r) => r.toLowerCase());
    if (!saved.includes(email.toLowerCase())) {
      return NextResponse.json({ error: "Save this recipient in report settings before sending a test email" }, { status: 400 });
    }

    // Each send generates a PDF and goes through the mail provider: cap it per store
    if (!(await rateLimit(`report-test-${tenantId}`, TEST_SENDS_PER_HOUR, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many test emails. Please try again later." }, { status: 429 });
    }

    const now = new Date();
    const timezone = settings?.timezone || "UTC";

    const data = await fetchDailyReportData(tenantId, now, timezone);
    const pdfBuffer = await generateDailyReportPdf(data);

    // Logged under its own type so the history shows it without counting as the day's scheduled report
    const attemptId = await startEmailAttempt({ tenant_id: tenantId, reportType: "DAILY_SALES_TEST", date: data.dateStr, recipients: [email] });
    try {
      await sendDailyReportEmail([email], pdfBuffer, data, data.timezone);
      await finishEmailAttempt(attemptId, "SUCCESS");
    } catch (sendError: any) {
      await finishEmailAttempt(attemptId, "FAILED", sendError?.message);
      return NextResponse.json({ error: "The test email could not be sent. Check the dispatch history for details." }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: `Test report email dispatched to ${email}` });
  } catch (error: any) {
    return handleApiError(error, "POST /api/settings/reports/test");
  }
}
