import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = "Pharmacy POS <onboarding@resend.dev>"; // Use a verified domain in production

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to Pharmacy POS!',
      html: `
        <div style="font-family: sans-serif; color: #111827;">
          <h2 style="color: #00668C;">Welcome, ${name}!</h2>
          <p>We are thrilled to have you onboard. Set up your pharmacy details and start managing your inventory.</p>
          <p>Best regards,<br/>The Pharmacy POS Team</p>
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
        <div style="font-family: sans-serif; color: #111827;">
          <h2 style="color: #00668C;">Password Reset Request</h2>
          <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #00668C; color: #FFF; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}
