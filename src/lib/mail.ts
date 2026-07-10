import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = "Pharmacy POS <onboarding@resend.dev>"; 

const baseStyles = `
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #111827;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 40px 20px;
  background-color: #FAFAFA;
`;

const cardStyles = `
  background-color: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const headerStyles = `
  color: #00668C;
  font-size: 24px;
  font-weight: 700;
  margin-top: 0;
  margin-bottom: 24px;
`;

const buttonStyles = `
  display: inline-block;
  padding: 14px 28px;
  background-color: #00668C;
  color: #FFFFFF;
  text-decoration: none;
  font-weight: 600;
  border-radius: 6px;
  margin-top: 24px;
  margin-bottom: 24px;
`;

export async function sendWelcomeEmail(email: string, name: string) {
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/login" style="${buttonStyles}">Go to Terminal</a>
            <p style="color: #6B7280; font-size: 14px; margin-top: 32px; border-top: 1px solid #E5E7EB; padding-top: 24px;">
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
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

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
            <p>Click the secure link below to set a new password. This link will expire in exactly 1 hour.</p>
            <a href="${resetLink}" style="${buttonStyles}">Reset My Password</a>
            <p>If you did not request this change, you can safely ignore this email. Your account remains secure.</p>
            <p style="color: #6B7280; font-size: 14px; margin-top: 32px; border-top: 1px solid #E5E7EB; padding-top: 24px;">
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
