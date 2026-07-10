"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { resetPasswordSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

const formSchema = resetPasswordSchema.omit({ token: true });
type ResetPasswordForm = z.infer<typeof formSchema>;

function ResetPasswordFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(formSchema)
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing reset token.");
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) return;
    setStatus("loading");
    try {
      await axios.post("/api/auth/reset-password", { ...data, token });
      setStatus("success");
      setMessage("Your password has been successfully reset.");
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.error || "An unexpected error occurred");
    }
  };

  return (
    <SplitLayout title="Set new password" subtitle="Enter your new secure password below.">
      {status === "success" ? (
        <div className="p-4 bg-success/10 border border-success/20 rounded-md text-center">
          <p className="text-success font-medium mb-2">{message}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {status === "error" && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{message}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <input 
              {...register("password")}
              type="password"
              disabled={!token || status === "loading"}
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50"
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <button 
            disabled={!token || status === "loading"}
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
          >
            {status === "loading" ? "Resetting..." : "Reset password"}
          </button>
        </form>
      )}
    </SplitLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <SplitLayout title="Set new password" subtitle="Loading secure environment...">
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </SplitLayout>
    }>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
