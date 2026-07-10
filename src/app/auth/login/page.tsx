"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { loginSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (res?.error) {
        if (res.error === "CredentialsSignin") {
          setError("Invalid email or password.");
        } else {
          setError(res.error);
        }
      } else {
        router.push("/dashboard"); // Middleware will handle redirecting to onboarding if necessary
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Welcome back" subtitle="Enter your credentials to access your terminal.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <input 
            {...register("email")}
            type="email"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            placeholder="pharmacist@example.com"
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Link href="/auth/forgot-password" className="text-sm text-primary hover:text-primary-hover font-medium">Forgot password?</Link>
          </div>
          <input 
            {...register("password")}
            type="password"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Don't have an account? <Link href="/auth/register" className="text-primary hover:text-primary-hover font-medium">Register</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
