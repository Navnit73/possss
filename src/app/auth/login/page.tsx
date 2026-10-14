"use client";

import { useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { loginSchema } from "@/lib/validations";
import { SplitLayout } from "@/components/auth/SplitLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

type LoginForm = z.infer<typeof loginSchema>;

// Matches the codes thrown by CustomAuthError in src/auth.ts.
const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "Too many login attempts. Please wait a minute and try again.",
  missing_fields: "Email and password are required.",
  invalid_credentials: "Invalid email or password.",
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Read without useSearchParams so the page doesn't need a Suspense boundary
  const justRegistered = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("registered") === "true",
    () => false
  );

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
        setError(LOGIN_ERROR_MESSAGES[res.code ?? ""] ?? "Invalid email or password.");
      } else {
        router.push("/dashboard"); // Middleware will handle redirecting to onboarding if necessary
        return; // keep the button disabled while navigating so it can't be submitted twice
      }
    } catch (err) {
      setError("An unexpected error occurred");
    }
    setIsLoading(false);
  };

  return (
    <SplitLayout title="Welcome back" subtitle="Enter your credentials to access your terminal.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {justRegistered && !error && (
          <Alert variant="success" role="status">Account created. Please sign in to continue.</Alert>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            {...register("email")}
            id="login-email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            type="email"
            placeholder="pharmacist@example.com"
          />
          {errors.email && <p className="text-caption text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="login-password">Password</Label>
            <Link href="/auth/forgot-password" className="text-caption text-primary hover:underline underline-offset-[3px]">Forgot password?</Link>
          </div>
          <Input
            {...register("password")}
            id="login-password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            type="password"
          />
          {errors.password && <p className="text-caption text-destructive">{errors.password.message}</p>}
        </div>

        <Button disabled={isLoading} type="submit" className="w-full">
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-caption text-ink-48 pt-2">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="text-primary hover:underline underline-offset-[3px]">Register</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
