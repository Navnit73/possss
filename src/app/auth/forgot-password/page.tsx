"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import axios from "axios";

type EmailForm = z.infer<typeof forgotPasswordSchema>;
const otpFormSchema = resetPasswordSchema.omit({ email: true });
type OtpForm = z.infer<typeof otpFormSchema>;

const errorText = "text-caption text-destructive";
const textLink = "text-primary hover:underline underline-offset-[3px]";

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

  const errorBox = error && <Alert variant="destructive">{error}</Alert>;

  if (step === "done") {
    return (
      <SplitLayout title="Password updated" subtitle="You can now sign in with your new password.">
        <Alert variant="success" role="status">
          <p className="font-semibold">Password reset successful</p>
          <p className="text-ink-48">Redirecting to login...</p>
        </Alert>
      </SplitLayout>
    );
  }

  if (step === "otp") {
    const { register, handleSubmit, formState: { errors } } = otpForm;
    return (
      <SplitLayout title="Enter verification code" subtitle={`Enter the 6-digit code sent to ${email} and choose a new password.`}>
        <form onSubmit={handleSubmit(resetPassword)} className="space-y-5">
          {info && <Alert variant="success" role="status">{info}</Alert>}
          {errorBox}

          <div className="space-y-2">
            <Label htmlFor="reset-otp">Verification code</Label>
            <Input
              {...register("otp")}
              id="reset-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={!!errors.otp}
              disabled={loading}
              className="tracking-[0.5em] text-center text-tagline tabular"
            />
            {errors.otp && <p className={errorText}>{errors.otp.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              {...register("password")}
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              disabled={loading}
            />
            {errors.password && <p className={errorText}>{errors.password.message}</p>}
          </div>

          <Button disabled={loading} type="submit" className="w-full mt-3">
            {loading ? "Resetting..." : "Reset password"}
          </Button>

          <p className="text-center text-caption text-ink-48 pt-2">
            Didn&apos;t get it?{" "}
            <button type="button" disabled={loading} onClick={() => sendOtp(email)} className={`${textLink} cursor-pointer disabled:opacity-40`}>
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
      <form onSubmit={handleSubmit((d) => sendOtp(d.email))} className="space-y-5">
        {errorBox}

        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            {...register("email")}
            id="forgot-email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            type="email"
          />
          {errors.email && <p className={errorText}>{errors.email.message}</p>}
        </div>

        <Button disabled={loading} type="submit" className="w-full mt-3">
          {loading ? "Sending..." : "Send OTP"}
        </Button>

        <p className="text-center text-caption text-ink-48 pt-2">
          Remembered your password? <Link href="/auth/login" className={textLink}>Sign in</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
