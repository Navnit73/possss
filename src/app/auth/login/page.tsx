"use client";

import { useState, useSyncExternalStore } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
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
  invalid_credentials: "That email and password don't match. Check them and try again.",
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  // Read without useSearchParams so the page doesn't need a Suspense boundary
  const justRegistered = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("registered") === "true",
    () => false
  );

  const { register, handleSubmit, setFocus, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  // A stale "wrong password" message is noise once the user starts correcting it
  const clearError = () => error && setError("");
  const emailField = register("email", { onChange: clearError });
  const passwordField = register("password", { onChange: clearError });

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
        setError(LOGIN_ERROR_MESSAGES[res.code ?? ""] ?? LOGIN_ERROR_MESSAGES.invalid_credentials);
        // Most failures are a mistyped password, so put the cursor back there
        setFocus("password", { shouldSelect: true });
      } else {
        router.push("/dashboard"); // Middleware will handle redirecting to onboarding if necessary
        return; // keep the button disabled while navigating so it can't be submitted twice
      }
    } catch {
      setError("Something went wrong while signing in. Check your connection and try again.");
    }
    setIsLoading(false);
  };

  const onPasswordKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));

  return (
    <SplitLayout title="Welcome back" subtitle="Sign in to run your counter, stock and reports.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {justRegistered && !error && (
          <Alert variant="success" role="status">Account created. Please sign in to continue.</Alert>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            {...emailField}
            id="login-email"
            autoComplete="email"
            autoFocus
            inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            type="email"
            placeholder="you@pharmacy.com"
          />
          {errors.email && <p id="login-email-error" className="text-caption text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center gap-3">
            <Label htmlFor="login-password">Password</Label>
            <Link href="/auth/forgot-password" className="text-caption text-primary hover:underline underline-offset-[3px]">Forgot password?</Link>
          </div>
          <div className="relative">
            <Input
              {...passwordField}
              id="login-password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={[errors.password && "login-password-error", capsLock && "login-caps-lock"].filter(Boolean).join(" ") || undefined}
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="pr-12"
              onKeyDown={onPasswordKey}
              onKeyUp={onPasswordKey}
              onBlur={(e) => {
                setCapsLock(false);
                passwordField.onBlur(e);
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48 hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p id="login-password-error" className="text-caption text-destructive">{errors.password.message}</p>}
          {capsLock && <p id="login-caps-lock" className="text-caption text-warning">Caps Lock is on.</p>}
        </div>

        <Button loading={isLoading} type="submit" className="w-full min-h-11 text-body mt-2">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-caption text-ink-48 pt-4 border-t border-divider-soft">
          New to Medishelf?{" "}
          <Link href="/auth/register" className="text-primary font-semibold hover:underline underline-offset-[3px]">Create a store account</Link>
        </p>
      </form>
    </SplitLayout>
  );
}
