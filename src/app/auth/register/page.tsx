"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      router.push("/auth/login?registered=true");
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SplitLayout title="Create an account" subtitle="Start managing your pharmacy efficiently.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}
        
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Full Name</label>
          <input 
            {...register("name")}
            type="text"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Email</label>
          <input 
            {...register("email")}
            type="email"
            className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Password</label>
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
