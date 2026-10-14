"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

type EmailForm = z.infer<typeof forgotPasswordSchema>;
const otpFormSchema = resetPasswordSchema.omit({ email: true });
type OtpForm = z.infer<typeof otpFormSchema>;

const inputClass =
  "w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50";
const buttonClass =
  "w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(forgotPasswordSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpFormSchema) });

  const sendOtp = async (addr: string) => {
    if (loading) return;
    setLoading(true);
    setError("");
    setInfo("");
    try {
      await axios.post("/api/auth/forgot-password", { email: addr });
      setEmail(addr);
      setStep("otp");
      setInfo(`If an account exists for ${addr}, a 6-digit code has been sent.`);
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (data: OtpForm) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/reset-password", { email, otp: data.otp, password: data.password });
      setStep("done");
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const errorBox = error && (
    <div role="alert" className="p-3 text-sm text-red-600 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>
  );

  if (step === "done") {
    return (
      <SplitLayout title="Password updated" subtitle="You can now sign in with your new password.">
        <div role="status" className="p-4 bg-success/10 border border-success/20 rounded-md text-center">
          <p className="text-success font-medium mb-2">Password reset successful</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </SplitLayout>
    );
  }

  if (step === "otp") {
    const { register, handleSubmit, formState: { errors } } = otpForm;
    return (
      <SplitLayout title="Enter verification code" subtitle={`Enter the 6-digit code sent to ${email} and choose a new password.`}>
        <form onSubmit={handleSubmit(resetPassword)} className="space-y-4">
          {info && <div role="status" className="p-3 text-sm text-success bg-success/10 rounded-md border border-success/20">{info}</div>}
          {errorBox}

          <div className="space-y-1">
            <label htmlFor="reset-otp" className="text-sm font-medium text-foreground">Verification code</label>
            <input
              {...register("otp")}
              id="reset-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={!!errors.otp}
              disabled={loading}
              className={`${inputClass} tracking-[0.5em] text-center text-lg`}
            />
            {errors.otp && <p className="text-sm text-red-500">{errors.otp.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="new-password" className="text-sm font-medium text-foreground">New Password</label>
            <input
              {...register("password")}
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              disabled={loading}
              className={inputClass}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <button disabled={loading} type="submit" className={buttonClass}>
            {loading ? "Resetting..." : "Reset password"}
          </button>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Didn&apos;t get it?{" "}
            <button type="button" disabled={loading} onClick={() => sendOtp(email)} className="text-primary hover:text-primary-hover font-medium">
              Resend code
            </button>
          </p>
        </form>
      </SplitLayout>
    );
  }

  const { register, handleSubmit, formState: { errors } } = emailForm;
  return (
    <SplitLayout title="Reset password" subtitle="Enter your email to receive a verification code.">
      <form onSubmit={handleSubmit((d) => sendOtp(d.email))} className="space-y-4">
        {errorBox}

        <div className="space-y-1">
          <label htmlFor="forgot-email" className="text-sm font-medium text-foreground">Email</label>
          <input
            {...register("email")}
            id="forgot-email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            type="email"
            className={inputClass}
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <button disabled={loading} type="submit" className={buttonClass}>
          {loading ? "Sending..." : "Send OTP"}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Remembered your password? <Link href="/auth/login" className="text-primary hover:text-primary-hover font-medium">Sign in</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
