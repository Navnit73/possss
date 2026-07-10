"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { forgotPasswordSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setStatus("loading");
    try {
      const res = await axios.post("/api/auth/forgot-password", data);
      setStatus("success");
      setMessage(res.data.message);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.response?.data?.error || "An unexpected error occurred");
    }
  };

  return (
    <SplitLayout title="Reset password" subtitle="Enter your email to receive a reset link.">
      {status === "success" ? (
        <div className="space-y-6">
          <div className="p-4 bg-success/10 border border-success/20 rounded-md">
            <p className="text-success font-medium text-center">{message}</p>
          </div>
          <Link href="/auth/login" className="block text-center text-primary hover:text-primary-hover font-medium">
            Return to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {status === "error" && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{message}</div>}
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input 
              {...register("email")}
              type="email"
              className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          <button 
            disabled={status === "loading"}
            type="submit"
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
          >
            {status === "loading" ? "Sending..." : "Send reset link"}
          </button>

          <p className="text-center text-sm text-muted-foreground pt-4">
            Remembered your password? <Link href="/auth/login" className="text-primary hover:text-primary-hover font-medium">Sign in</Link>
          </p>
        </form>
      )}
    </SplitLayout>
  );
}
