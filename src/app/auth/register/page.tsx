"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { registerSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import axios from "axios";

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError("");
    try {
      await axios.post("/api/auth/register", data);

      // Sign straight in so the owner lands in onboarding instead of retyping credentials.
      const res = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });
      router.push(res?.error ? "/auth/login?registered=true" : "/onboarding/create-store");
      return; // keep the button disabled while navigating so the account isn't submitted twice
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    }
    setIsLoading(false);
  };

  return (
    <SplitLayout title="Create an account" subtitle="Start managing your pharmacy efficiently.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <div role="alert" className="p-3 text-sm text-red-600 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>}
        
        <div className="space-y-1">
          <label htmlFor="register-name" className="text-sm font-medium text-foreground">Full Name</label>
          <input 
            {...register("name")}
            id="register-name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            type="text"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="register-email" className="text-sm font-medium text-foreground">Email</label>
          <input 
            {...register("email")}
            id="register-email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            type="email"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="register-password" className="text-sm font-medium text-foreground">Password</label>
          <input 
            {...register("password")}
            id="register-password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            type="password"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        <button 
          disabled={isLoading}
          type="submit"
          className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium py-2.5 rounded-md transition-colors mt-6 disabled:opacity-50"
        >
          {isLoading ? "Creating account..." : "Register"}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-4">
          Already have an account? <Link href="/auth/login" className="text-primary hover:text-primary-hover font-medium">Sign in</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
