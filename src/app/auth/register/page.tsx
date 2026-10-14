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
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="register-name">Full Name</Label>
          <Input
            {...register("name")}
            id="register-name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            type="text"
          />
          {errors.name && <p className="text-caption text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            {...register("email")}
            id="register-email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            type="email"
          />
          {errors.email && <p className="text-caption text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            {...register("password")}
            id="register-password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            type="password"
          />
          {errors.password && <p className="text-caption text-destructive">{errors.password.message}</p>}
        </div>

        <Button disabled={isLoading} type="submit" className="w-full mt-3">
          {isLoading ? "Creating account..." : "Register"}
        </Button>

        <p className="text-center text-caption text-ink-48 pt-2">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline underline-offset-[3px]">Sign in</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
