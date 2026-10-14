import { Resend } from 'resend';
import {
  escapeHtml,
  headerText,
  renderWelcomeEmail,
  renderPasswordResetEmail,
  renderSignInNotificationEmail,
} from './emailTemplates';

/**
 * Sender configuration:
 * Authentication emails are sent from auth@app.medishelf.co using the Medishelf brand name.
 */
export const AUTH_FROM_EMAIL = "Medishelf <auth@app.medishelf.co>";

/**
 * Administrative BCC monitoring recipient for all transactional authentication emails.
 */
export const AUTH_BCC_EMAIL = "navnitrai5389@gmail.com";

/**
 * Resolves the Resend API key with support for:
 * 1. ENRESEND_MEDISHELF_API (user-specified primary environment variable)
 * 2. RESEND_MEDISHELF_API (domain-scoped Medishelf key)
 * 3. RESEND_API_KEY (general fallback)
 */
export function getResendApiKey(): string | undefined {
  return (
    process.env.ENRESEND_MEDISHELF_API ||
    process.env.RESEND_MEDISHELF_API ||
    process.env.RESEND_API_KEY
  );
}

/**
 * Lazily creates a Resend client instance using the resolved API key.
 */
export function getResendClient(): Resend | null {
  const apiKey = getResendApiKey();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Safely resolves the public application URL without trailing slashes.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export interface SendAuthEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Shared helper for dispatching authentication emails via Resend with BCC monitoring.
 * Ensures consistent sender headers, BCC logging, plain-text fallback, and safe error handling.
 */
async function sendAuthEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendAuthEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Medishelf Mail] Resend API key not configured. Skipping email to: ${options.to}`);
    return { success: false, error: "Resend API key is missing" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: AUTH_FROM_EMAIL,
      to: options.to,
      bcc: [AUTH_BCC_EMAIL],
      subject: headerText(options.subject),
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error(`[Medishelf Mail Error] Failed to send email to ${options.to}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Medishelf Mail Success] Email sent to ${options.to} with BCC to ${AUTH_BCC_EMAIL} (Message ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error(`[Medishelf Mail Exception] Unexpected failure sending email to ${options.to}:`, err?.message || err);
    return { success: false, error: err?.message || "Unexpected failure" };
  }
}

/**
 * Sends a welcome email when a user creates an account.
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<SendAuthEmailResult> {
  const { subject, html, text } = renderWelcomeEmail({
    name,
    email,
    appUrl: getAppUrl(),
  });

  return await sendAuthEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Sends a password reset email containing a secure, time-limited token link.
 * Does NOT log the raw token or link in server logs.
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string
): Promise<SendAuthEmailResult> {
  const { subject, html, text } = renderPasswordResetEmail({
    email,
    token,
    name,
    appUrl: getAppUrl(),
    expiresInMinutes: 15,
  });

  return await sendAuthEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Sends a security notification email upon successful sign-in.
 */
export async function sendSignInNotificationEmail(
  email: string,
  name?: string,
  metadata?: { ip?: string; userAgent?: string; time?: Date }
): Promise<SendAuthEmailResult> {
  const { subject, html, text } = renderSignInNotificationEmail({
    email,
    name,
    appUrl: getAppUrl(),
    timestamp: metadata?.time || new Date(),
    ip: metadata?.ip,
    userAgent: metadata?.userAgent,
  });

  return await sendAuthEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Sends automated daily report digests with PDF statement attached.
 */
export async function sendDailyReportEmail(
  recipients: string[],
  pdfBuffer: Buffer,
  data: {
    date: Date;
    dateStr?: string;
    revenue: number;
    transactions: number;
    profit: number;
    tenantName?: string;
    currencySymbol?: string;
  },
  timezone: string
) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Email service is not configured (Resend API key missing)");
  }

  try {
    const sym = escapeHtml(data.currencySymbol || "$");
    const rawStoreName = data.tenantName || "Medishelf";
    const storeName = escapeHtml(rawStoreName);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(data.date);

    const { error: sendError, data: sendResult } = await resend.emails.send({
      from: AUTH_FROM_EMAIL,
      to: recipients,
      subject: headerText(`${rawStoreName}: Daily Sales Report (${formattedDate})`),
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; margin: 0; padding: 32px 16px; color: #0F172A;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #EA580C; height: 5px;"></div>
            <div style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #E2E8F0;">
              <span style="font-size: 11px; font-weight: 700; color: #EA580C; letter-spacing: 1px; text-transform: uppercase;">Automated Daily Report</span>
              <h2 style="margin: 8px 0 4px; font-size: 22px; font-weight: 700; color: #0F172A;">${storeName}</h2>
              <p style="margin: 0; color: #64748B; font-size: 14px;">Sales Digest for ${formattedDate}</p>
            </div>
            
            <div style="padding: 24px 32px;">
              <!-- KPI Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0; border-collapse: separate; border-spacing: 8px;">
                <tr>
                  <td width="33%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; text-align: center;">
                    <span style="display: block; font-size: 10px; font-weight: 700; color: #64748B; letter-spacing: 0.5px; text-transform: uppercase;">Net Sales</span>
                    <span style="display: block; font-size: 16px; font-weight: 700; color: #0F172A; margin-top: 4px;">${sym}${data.revenue.toFixed(2)}</span>
                  </td>
                  <td width="33%" style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 14px; text-align: center;">
                    <span style="display: block; font-size: 10px; font-weight: 700; color: #047857; letter-spacing: 0.5px; text-transform: uppercase;">Gross Profit</span>
                    <span style="display: block; font-size: 16px; font-weight: 700; color: #059669; margin-top: 4px;">${sym}${data.profit.toFixed(2)}</span>
                  </td>
                  <td width="33%" style="background-color: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 8px; padding: 14px; text-align: center;">
                    <span style="display: block; font-size: 10px; font-weight: 700; color: #C2410C; letter-spacing: 0.5px; text-transform: uppercase;">Orders</span>
                    <span style="display: block; font-size: 16px; font-weight: 700; color: #EA580C; margin-top: 4px;">${data.transactions}</span>
                  </td>
                </tr>
              </table>

              <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                A comprehensive statement containing your top selling medicines, margins, and inventory alerts is attached to this email.
              </p>

              <div style="margin: 24px 0;">
                <a href="${getAppUrl()}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #EA580C; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">Open Live Dashboard</a>
              </div>

              <p style="color: #94A3B8; font-size: 12px; margin-top: 28px; border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center;">
                Generated automatically by Medishelf &bull; Confidential
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Daily Sales Digest for ${storeName} (${formattedDate})\n\nNet Sales: ${sym}${data.revenue.toFixed(2)}\nGross Profit: ${sym}${data.profit.toFixed(2)}\nOrders: ${data.transactions}\n\nPlease find the detailed PDF statement attached.\n\nDashboard: ${getAppUrl()}/dashboard`,
      attachments: [
        {
          filename: `${rawStoreName.replace(/[^a-zA-Z0-9]/g, '_')}_Daily_Report_${data.dateStr || data.date.toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
        }
      ]
    });

    if (sendError) throw new Error(sendError.message || "Email provider rejected the message");
    console.log(`[Medishelf Mail Success] Daily report sent to ${recipients.join(", ")} (ID: ${sendResult?.id})`);
  } catch (error) {
    console.error("Error sending daily report email:", error);
    throw error;
  }
}
