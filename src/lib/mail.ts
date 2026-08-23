import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = "Pharmacy POS <onboarding@resend.dev>"; 

const baseStyles = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #0F172A;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 32px 16px;
  background-color: #F8FAFC;
`;

const cardStyles = `
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 36px 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const headerStyles = `
  color: #0F172A;
  font-size: 22px;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 8px;
`;

const buttonStyles = `
  display: inline-block;
  padding: 12px 24px;
  background-color: #0F172A;
  color: #FFFFFF !important;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  border-radius: 6px;
  margin-top: 20px;
  margin-bottom: 20px;
`;

export async function sendWelcomeEmail(email: string, name: string) {
  if (!resend) {
    console.warn("⚠️ RESEND_API_KEY is not configured. Skipping welcome email to:", email);
    return;
  }
  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to Pharmacy POS!',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="${headerStyles}">Welcome, ${name}!</h2>
            <p>We are thrilled to have you onboard.</p>
            <p>Pharmacy POS is designed to bring clinical precision and retail efficiency to your workflow. Your next step is to set up your pharmacy details and start managing your inventory.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/login" style="${buttonStyles}">Go to Terminal</a>
            <p style="color: #64748B; font-size: 13px; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px;">
              Best regards,<br/>The Pharmacy POS Team
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;

  if (!resend) {
    console.warn("⚠️ RESEND_API_KEY is not configured. Reset link for", email, "is:", resetLink);
    return;
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset your password',
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <h2 style="${headerStyles}">Password Reset Request</h2>
            <p>We received a request to reset your password for your Pharmacy POS account.</p>
            <p>Click the secure link below to set a new password. This link will expire in 1 hour.</p>
            <a href="${resetLink}" style="${buttonStyles}">Reset My Password</a>
            <p style="font-size: 13px; color: #64748B;">If you did not request this change, you can safely ignore this email.</p>
            <p style="color: #64748B; font-size: 13px; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 20px;">
              Best regards,<br/>The Pharmacy POS Team
            </p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}

export async function sendDailyReportEmail(
  recipients: string[], 
  pdfBuffer: Buffer, 
  data: { 
    date: Date; 
    revenue: number; 
    transactions: number; 
    profit: number; 
    tenantName?: string; 
    currencySymbol?: string;
  },
  timezone: string
) {
  if (!resend) {
    console.warn("⚠️ RESEND_API_KEY is not configured. Skipping daily report email to:", recipients);
    return;
  }
  try {
    const sym = data.currencySymbol || "$";
    const storeName = data.tenantName || "Pharmacy POS";

    const formattedDate = new Intl.DateTimeFormat('en-US', { 
      timeZone: timezone,
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(data.date);
    
    await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject: `${storeName}: Daily Sales Report (${formattedDate})`,
      html: `
        <div style="${baseStyles}">
          <div style="${cardStyles}">
            <div style="border-bottom: 1px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 20px;">
              <span style="font-size: 11px; font-weight: 700; color: #059669; letter-spacing: 1px; text-transform: uppercase;">Automated Daily Report</span>
              <h2 style="${headerStyles}">${storeName}</h2>
              <p style="margin: 0; color: #64748B; font-size: 14px;">Sales Digest for ${formattedDate}</p>
            </div>
            
            <!-- KPI Grid -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 20px 0; border-collapse: separate; border-spacing: 8px;">
              <tr>
                <td width="33%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; text-align: center;">
                  <span style="display: block; font-size: 10px; font-weight: 700; color: #64748B; letter-spacing: 0.5px; text-transform: uppercase;">Total Revenue</span>
                  <span style="display: block; font-size: 16px; font-weight: 700; color: #0F172A; margin-top: 4px;">${sym}${data.revenue.toFixed(2)}</span>
                </td>
                <td width="33%" style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 14px; text-align: center;">
                  <span style="display: block; font-size: 10px; font-weight: 700; color: #047857; letter-spacing: 0.5px; text-transform: uppercase;">Gross Profit</span>
                  <span style="display: block; font-size: 16px; font-weight: 700; color: #059669; margin-top: 4px;">${sym}${data.profit.toFixed(2)}</span>
                </td>
                <td width="33%" style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 14px; text-align: center;">
                  <span style="display: block; font-size: 10px; font-weight: 700; color: #1D4ED8; letter-spacing: 0.5px; text-transform: uppercase;">Orders</span>
                  <span style="display: block; font-size: 16px; font-weight: 700; color: #2563EB; margin-top: 4px;">${data.transactions}</span>
                </td>
              </tr>
            </table>

            <p style="font-size: 14px; color: #334155;">
              A comprehensive PDF statement containing your top selling items and inventory reorder alerts is attached to this email.
            </p>

            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="${buttonStyles}">Open Live Dashboard</a>

            <p style="color: #94A3B8; font-size: 12px; margin-top: 28px; border-top: 1px solid #E2E8F0; padding-top: 20px; text-align: center;">
              Generated automatically by ${storeName} • Confidential
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_Daily_Report_${data.date.toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
        }
      ]
    });
  } catch (error) {
    console.error("Error sending daily report email:", error);
    throw error;
  }
}
