"use client";

import { useState } from "react";
import { Smartphone, ShieldCheck, Eye, EyeOff, KeyRound, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, StatCard } from "@/components/ui/Page";
import { signOut } from "next-auth/react";

/** `color` is the meter fill; `textColor` tones the label (status tones are text-only). */
function calculatePasswordStrength(pass: string): { score: number; label: string; color: string; textColor: string; width: string } {
  if (!pass) return { score: 0, label: "", color: "bg-ink", textColor: "text-ink-48", width: "0%" };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-ink", textColor: "text-destructive", width: "20%" };
  if (score === 2) return { score, label: "Fair", color: "bg-ink", textColor: "text-warning", width: "40%" };
  if (score === 3) return { score, label: "Good", color: "bg-ink", textColor: "text-ink", width: "70%" };
  return { score, label: "Strong", color: "bg-ink", textColor: "text-success", width: "100%" };
}

export default function SecurityPage() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const strength = calculatePasswordStrength(passwordForm.newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (passwordForm.newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setError("New password must be strictly different from your current password");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/account/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setSuccess("Password updated. For your security, all sessions are being signed out — please sign in again with your new password.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      // A password change ends every existing session (including this one) on its next access check
      setTimeout(() => signOut({ callbackUrl: "/auth/login" }), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell className="max-w-[980px]">
      <PageHeader
        title="Security Settings"
        description="Manage your account authentication credentials, password strength, and security preferences."
      />

      {/* Notifications */}
      {error && (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      )}

      {success && (
        <Alert variant="success" role="status">
          <span>{success}</span>
        </Alert>
      )}

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label="Password protection"
          icon={KeyRound}
          value={<span className="text-tagline">Bcrypt Encrypted</span>}
          hint="Salting & hashing with cost factor 12"
        />
        <StatCard
          label="Audit trail logging"
          icon={ShieldCheck}
          tone="success"
          value={<span className="text-tagline">Active Monitoring</span>}
          hint="IP & device context captured on edits"
        />
        <StatCard
          label="Session protection"
          icon={Zap}
          value={<span className="text-tagline">JWT Authorized</span>}
          hint="Secure HTTP-only session tokens"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Change Password Form (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Change Account Password</CardTitle>
            <CardDescription>Required every 90 days recommended</CardDescription>
          </CardHeader>

          <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  autoComplete="current-password"
                  type={showCurrent ? "text" : "password"}
                  required
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-3">
                <Label htmlFor="new-password">New password</Label>
                {passwordForm.newPassword && (
                  <span className={`text-caption font-semibold ${strength.textColor}`}>
                    {strength.label} Password
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="new-password"
                  autoComplete="new-password"
                  type={showNew ? "text" : "password"}
                  required
                  minLength={8}
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  placeholder="Minimum 8 characters"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {passwordForm.newPassword && (
                <div className="space-y-2 pt-1">
                  <div className="h-1.5 w-full bg-divider-soft rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-300 ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                  <div className="grid grid-cols-2 text-fine-print text-ink-48 gap-1">
                    <span className={passwordForm.newPassword.length >= 8 ? "text-success font-semibold flex items-center gap-1" : ""}>
                      {passwordForm.newPassword.length >= 8 ? "✓ At least 8 chars" : "• At least 8 chars"}
                    </span>
                    <span className={/[0-9]/.test(passwordForm.newPassword) ? "text-success font-semibold flex items-center gap-1" : ""}>
                      {/[0-9]/.test(passwordForm.newPassword) ? "✓ Contains number" : "• Contains number"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  autoComplete="new-password"
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  placeholder="Re-enter new password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="press cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 text-ink-48"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-caption text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              loading={loading}
              disabled={loading || (passwordForm.confirmPassword !== "" && passwordForm.newPassword !== passwordForm.confirmPassword)}
              className="w-full"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
          </CardContent>
        </Card>

        {/* Security Best Practices Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Security Checklist */}
          <Card className="p-6 space-y-4">
            <h3 className="text-body font-semibold text-ink">Security checklist</h3>

            <ul className="space-y-3 text-caption text-ink-80">
              <li className="flex items-start gap-2">
                <Check className="size-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong className="font-semibold text-ink">Unique Password:</strong> Avoid using passwords shared across other websites.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong className="font-semibold text-ink">Role Isolation:</strong> Ensure staff permissions align with least privilege principles.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
                <span><strong className="font-semibold text-ink">Audit Log Tracking:</strong> Security and login actions are recorded for administrative auditing.</span>
              </li>
            </ul>
          </Card>

          {/* 2FA Status Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-ink-48" aria-hidden="true" />
                <h4 className="text-body font-semibold text-ink">Two-factor authentication</h4>
              </div>
              <Badge variant="secondary">Coming soon</Badge>
            </div>
            <p className="text-caption text-ink-48">
              Enhance account protection by requiring TOTP authenticator app verification codes upon sign-in.
            </p>
            <Button disabled variant="outline" size="sm" className="w-full">
              Enable 2FA Authenticator
            </Button>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
