import { redirect } from "next/navigation";

// Password reset now uses an emailed OTP, handled entirely on the forgot-password page.
export default function ResetPasswordPage() {
  redirect("/auth/forgot-password");
}
