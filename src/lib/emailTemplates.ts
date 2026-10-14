/**
 * Production-ready email templates for Medishelf.
 * Designed with a pharmacy SaaS aesthetic using Medishelf brand colors:
 * - Primary Orange: #EA580C
 * - Deep Orange: #C2410C
 * - Dark Slate: #0F172A
 * - Light Background: #F8FAFC
 * - White Card: #FFFFFF
 *
 * Fully compatible with major email clients (Gmail, Outlook, Apple Mail)
 * using table-based layouts, inline styles, and web-safe typography.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] || c;
  });
}

export function headerText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

interface EmailLayoutOptions {
  preheader: string;
  badgeText: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  badgeBorderColor?: string;
  title: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryNoteHtml?: string;
}

/**
 * Base email layout wrapper with responsive table layout and bulletproof styling.
 */
function renderEmailLayout(options: EmailLayoutOptions): string {
  const {
    preheader,
    badgeText,
    badgeBgColor = "#FFF7ED",
    badgeTextColor = "#EA580C",
    badgeBorderColor = "#FFEDD5",
    title,
    bodyHtml,
    ctaText,
    ctaUrl,
    secondaryNoteHtml,
  } = options;

  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F8FAFC; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .mobile-p-24 { padding: 24px 18px !important; }
      .mobile-full-width { width: 100% !important; display: block !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text (visible in inbox snippet) -->
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Top Brand Accent Bar (Medishelf Orange) -->
          <tr>
            <td style="background-color: #EA580C; height: 5px; font-size: 0px; line-height: 0px;">&nbsp;</td>
          </tr>

          <!-- Header / Brand Section -->
          <tr>
            <td class="mobile-p-24" style="padding: 32px 36px 20px 36px; border-bottom: 1px solid #F1F5F9;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Medishelf Icon Box -->
                        <td style="vertical-align: middle; padding-right: 12px;">
                          <div style="background-color: #EA580C; width: 36px; height: 36px; border-radius: 8px; text-align: center; line-height: 36px; color: #FFFFFF; font-weight: 800; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            +
                          </div>
                        </td>
                        <!-- Medishelf Wordmark -->
                        <td style="vertical-align: middle;">
                          <span style="font-size: 20px; font-weight: 700; color: #0F172A; letter-spacing: -0.3px; display: inline-block;">Medishelf</span>
                          <span style="font-size: 11px; font-weight: 600; color: #EA580C; background-color: #FFF7ED; padding: 2px 6px; border-radius: 4px; margin-left: 6px; vertical-align: middle; letter-spacing: 0.5px; text-transform: uppercase;">POS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 9999px; background-color: ${badgeBgColor}; color: ${badgeTextColor}; border: 1px solid ${badgeBorderColor};">
                      ${escapeHtml(badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Section -->
          <tr>
            <td class="mobile-p-24" style="padding: 32px 36px 36px 36px;">
              <h1 style="margin: 0 0 16px 0; color: #0F172A; font-size: 22px; font-weight: 700; line-height: 1.35; letter-spacing: -0.2px;">
                ${escapeHtml(title)}
              </h1>
              
              <div style="color: #334155; font-size: 15px; line-height: 1.6;">
                ${bodyHtml}
              </div>

              ${ctaText && ctaUrl ? `
                <!-- CTA Button -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 24px 0;">
                  <tr>
                    <td align="center" style="border-radius: 8px; background-color: #EA580C;">
                      <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 8px; background-color: #EA580C; border: 1px solid #EA580C; mso-padding-alt: 0;">
                        <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 20pt">&nbsp;</i><![endif]-->
                        <span style="mso-text-raise: 10pt; color: #FFFFFF;">${escapeHtml(ctaText)}</span>
                        <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%">&nbsp;</i><![endif]-->
                      </a>
                    </td>
                  </tr>
                </table>
              ` : ""}

              ${secondaryNoteHtml ? `
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #F1F5F9; color: #64748B; font-size: 13px; line-height: 1.5;">
                  ${secondaryNoteHtml}
                </div>
              ` : ""}
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td class="mobile-p-24" style="padding: 24px 36px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #64748B; font-size: 12px; line-height: 1.5;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">
                      Medishelf Pharmacy Management &bull; Precision & Compliance
                    </p>
                    <p style="margin: 0 0 8px 0;">
                      This is an automated security and transactional message sent from <a href="https://app.medishelf.co" style="color: #EA580C; text-decoration: none;">app.medishelf.co</a>.
                    </p>
                    <p style="margin: 0; color: #94A3B8;">
                      &copy; ${currentYear} Medishelf. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* =========================================================================
   1. WELCOME EMAIL
   ========================================================================= */

export interface WelcomeEmailData {
  name: string;
  email: string;
  appUrl: string;
}

export function renderWelcomeEmail(data: WelcomeEmailData): { subject: string; html: string; text: string } {
  const { name, email, appUrl } = data;
  const firstName = name.trim().split(" ")[0] || "there";
  const loginUrl = `${appUrl.replace(/\/+$/, "")}/auth/login`;
  const subject = `Welcome to Medishelf, ${firstName}! Set up your pharmacy`;
  const preheader = `Your Medishelf account is ready. Complete your store setup and start managing inventory.`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hi <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0;">
      We're thrilled to welcome you to <strong>Medishelf</strong>! Your account for <code>${escapeHtml(email)}</code> has been created successfully.
    </p>
    <p style="margin: 0 0 20px 0;">
      Medishelf brings clinical precision and retail efficiency to your daily operations—from fast barcode sales and batch tracking to automated daily sales reporting.
    </p>

    <!-- Getting Started Checklist Card -->
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">
        🚀 Your Next Steps
      </h3>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: top; width: 24px; padding-bottom: 12px; color: #EA580C; font-weight: 700; font-size: 14px;">1.</td>
          <td style="vertical-align: top; padding-bottom: 12px; color: #334155; font-size: 14px;">
            <strong>Set up your store:</strong> Add your pharmacy name, address, and license details.
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top; width: 24px; padding-bottom: 12px; color: #EA580C; font-weight: 700; font-size: 14px;">2.</td>
          <td style="vertical-align: top; padding-bottom: 12px; color: #334155; font-size: 14px;">
            <strong>Add inventory:</strong> Populate your medicines, batches, MRP, and expiry dates.
          </td>
        </tr>
        <tr>
          <td style="vertical-align: top; width: 24px; color: #EA580C; font-weight: 700; font-size: 14px;">3.</td>
          <td style="vertical-align: top; color: #334155; font-size: 14px;">
            <strong>Launch POS Terminal:</strong> Start ringing up sales with fast search and instant receipts.
          </td>
        </tr>
      </table>
    </div>

    <p style="margin: 0 0 8px 0;">
      Ready to get started? Log in to your workspace below:
    </p>
  `;

  const secondaryNoteHtml = `
    <p style="margin: 0 0 6px 0;">
      If the button above does not work, copy and paste this link into your browser:
    </p>
    <p style="margin: 0; word-break: break-all;">
      <a href="${escapeHtml(loginUrl)}" style="color: #EA580C; text-decoration: underline;">${escapeHtml(loginUrl)}</a>
    </p>
    <p style="margin: 14px 0 0 0; color: #94A3B8; font-size: 12px;">
      Need assistance? Reply directly to this email or reach us at <a href="mailto:support@medishelf.co" style="color: #64748B;">support@medishelf.co</a>.
    </p>
  `;

  const html = renderEmailLayout({
    preheader,
    badgeText: "Account Created",
    badgeBgColor: "#ECFDF5",
    badgeTextColor: "#059669",
    badgeBorderColor: "#A7F3D0",
    title: `Welcome to Medishelf, ${firstName}!`,
    bodyHtml,
    ctaText: "Go to Medishelf Terminal",
    ctaUrl: loginUrl,
    secondaryNoteHtml,
  });

  const text = `
Welcome to Medishelf, ${name}!
=======================================

Your Medishelf account for ${email} has been successfully created.

Medishelf brings clinical precision and retail efficiency to your daily pharmacy operations.

Your Next Steps:
1. Set up your store: Add your pharmacy name, address, and license details.
2. Add inventory: Populate your medicines, batches, MRP, and expiry dates.
3. Launch POS Terminal: Start ringing up sales with fast search and instant receipts.

Access your account here:
${loginUrl}

Need help? Contact our support team at support@medishelf.co

---
Medishelf Pharmacy Management • https://app.medishelf.co
© ${new Date().getFullYear()} Medishelf. All rights reserved.
  `.trim();

  return { subject, html, text };
}

/* =========================================================================
   2. PASSWORD RESET EMAIL
   ========================================================================= */

export interface PasswordResetEmailData {
  email: string;
  otp: string;
  name?: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(data: PasswordResetEmailData): { subject: string; html: string; text: string } {
  const { email, otp, name, expiresInMinutes = 10 } = data;
  const displayName = name?.trim() ? name.trim() : "there";
  const subject = "Your Medishelf password reset code";
  const preheader = `Your verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hello <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
      We received a request to reset the password for your Medishelf account associated with <strong>${escapeHtml(email)}</strong>.
    </p>
    <p style="margin: 0 0 12px 0;">
      Enter this code on the reset page. It expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
    </p>
    <div style="text-align: center; margin: 20px 0; padding: 16px; background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #EA580C; font-family: 'Courier New', monospace;">${escapeHtml(otp)}</span>
    </div>

    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 20px 0; color: #92400E; font-size: 13px; line-height: 1.5;">
      <strong>Did not request this?</strong> You can safely ignore this email. Your password will remain unchanged. Never share this code with anyone.
    </div>
  `;

  const html = renderEmailLayout({
    preheader,
    badgeText: "Security Notice",
    badgeBgColor: "#FEF2F2",
    badgeTextColor: "#DC2626",
    badgeBorderColor: "#FECACA",
    title: "Password Reset Code",
    bodyHtml,
  });

  const text = `
Password Reset Code
=======================================

Hello ${displayName},

We received a request to reset your Medishelf account password (${email}).

Your verification code (valid for ${expiresInMinutes} minutes): ${otp}

If you did not request this, you can safely ignore this email. Never share this code with anyone.

---
Medishelf Pharmacy Management • https://app.medishelf.co
© ${new Date().getFullYear()} Medishelf. All rights reserved.
  `.trim();

  return { subject, html, text };
}

/* =========================================================================
   3. SUCCESSFUL SIGN-IN NOTIFICATION EMAIL
   ========================================================================= */

export interface SignInNotificationEmailData {
  email: string;
  name?: string;
  appUrl: string;
  timestamp?: Date;
  ip?: string;
  userAgent?: string;
}

export function renderSignInNotificationEmail(data: SignInNotificationEmailData): { subject: string; html: string; text: string } {
  const { email, name, appUrl, timestamp = new Date(), ip = "Unknown", userAgent } = data;
  const displayName = name?.trim() ? name.trim() : "there";
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(timestamp);

  const securityUrl = `${appUrl.replace(/\/+$/, "")}/auth/forgot-password`;
  const subject = "Security Alert: New sign-in to your Medishelf account";
  const preheader = `A new sign-in was detected for ${email} on ${formattedTime} UTC.`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hello <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 20px 0;">
      This is a quick confirmation that your Medishelf account was just signed into successfully.
    </p>

    <!-- Sign-in Details Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin: 20px 0; border-collapse: separate; overflow: hidden;">
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 13px; font-weight: 600; width: 35%;">Date & Time</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 13px; font-weight: 500;">${escapeHtml(formattedTime)} (UTC)</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 13px; font-weight: 600;">Account</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 13px; font-weight: 500;">${escapeHtml(email)}</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-bottom: ${userAgent ? "1px solid #E2E8F0" : "none"}; color: #64748B; font-size: 13px; font-weight: 600;">IP Address</td>
        <td style="padding: 12px 16px; border-bottom: ${userAgent ? "1px solid #E2E8F0" : "none"}; color: #0F172A; font-size: 13px; font-weight: 500; font-family: monospace;">${escapeHtml(ip)}</td>
      </tr>
      ${userAgent ? `
      <tr>
        <td style="padding: 12px 16px; color: #64748B; font-size: 13px; font-weight: 600;">Device / Client</td>
        <td style="padding: 12px 16px; color: #0F172A; font-size: 12px; font-family: monospace; word-break: break-all;">${escapeHtml(userAgent.slice(0, 100))}</td>
      </tr>
      ` : ""}
    </table>

    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #991B1B; font-size: 13px; line-height: 1.5;">
        <strong>Didn't sign in?</strong> If you did not initiate this login, your account may be compromised. Please reset your password immediately using the link below to protect your pharmacy data.
      </p>
    </div>
  `;

  const secondaryNoteHtml = `
    <p style="margin: 0; color: #64748B; font-size: 12px;">
      If this was you, no action is needed. You can manage your security preferences anytime in your account settings.
    </p>
  `;

  const html = renderEmailLayout({
    preheader,
    badgeText: "Security Alert",
    badgeBgColor: "#EFF6FF",
    badgeTextColor: "#1D4ED8",
    badgeBorderColor: "#BFDBFE",
    title: "New Sign-In Detected",
    bodyHtml,
    ctaText: "Secure My Account / Reset Password",
    ctaUrl: securityUrl,
    secondaryNoteHtml,
  });

  const text = `
Security Alert: New sign-in to your Medishelf account
===================================================

Hello ${displayName},

A successful sign-in to your Medishelf account was detected:

Time: ${formattedTime} UTC
Account: ${email}
IP Address: ${ip}
${userAgent ? `Device: ${userAgent}\n` : ""}
If this was you, you can safely ignore this notification.

If you did NOT sign in, please secure your account immediately by resetting your password:
${securityUrl}

---
Medishelf Pharmacy Management • https://app.medishelf.co
© ${new Date().getFullYear()} Medishelf. All rights reserved.
  `.trim();

  return { subject, html, text };
}


/* =========================================================================
   4. SUBSCRIPTION CANCELLED EMAIL
   ========================================================================= */

export interface SubscriptionCancelledEmailData {
  email: string;
  name?: string;
  appUrl: string;
  planName: string;
  /** When access ends; null/undefined means it ended immediately. */
  accessEndsAt?: Date | null;
}

export function renderSubscriptionCancelledEmail(data: SubscriptionCancelledEmailData): { subject: string; html: string; text: string } {
  const { email, name, appUrl, planName, accessEndsAt } = data;
  const displayName = name?.trim() ? name.trim() : "there";
  const manageUrl = `${appUrl.replace(/\/+$/, "")}/account/subscription`;
  const endDate = accessEndsAt
    ? accessEndsAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const subject = "Your Medishelf subscription has been cancelled";
  const accessLine = endDate
    ? `Your ${planName} plan will not renew. You'll keep full access until <strong>${escapeHtml(endDate)}</strong>.`
    : `Your ${planName} plan has been cancelled and will not renew.`;
  const accessLineText = endDate
    ? `Your ${planName} plan will not renew. You'll keep full access until ${endDate}.`
    : `Your ${planName} plan has been cancelled and will not renew.`;

  const bodyHtml = `
    <p style="margin: 0 0 16px 0;">
      Hello <strong>${escapeHtml(displayName)}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
      We've received your request to cancel the subscription for <strong>${escapeHtml(email)}</strong>.
    </p>
    <p style="margin: 0 0 16px 0;">${accessLine}</p>
    <p style="margin: 0 0 16px 0;">
      Changed your mind? You can keep your subscription any time before it ends from your account.
    </p>
  `;

  const html = renderEmailLayout({
    preheader: endDate ? `Your plan will not renew. Access continues until ${endDate}.` : "Your plan has been cancelled.",
    badgeText: "Billing",
    badgeBgColor: "#FFF7ED",
    badgeTextColor: "#C2410C",
    badgeBorderColor: "#FED7AA",
    title: "Subscription Cancelled",
    bodyHtml,
    ctaText: "Manage Subscription",
    ctaUrl: manageUrl,
  });

  const text = `
Subscription Cancelled
=======================================

Hello ${displayName},

We've received your request to cancel the subscription for ${email}.

${accessLineText}

Changed your mind? Keep your subscription here: ${manageUrl}

---
Medishelf Pharmacy Management • https://app.medishelf.co
© ${new Date().getFullYear()} Medishelf. All rights reserved.
  `.trim();

  return { subject, html, text };
}
