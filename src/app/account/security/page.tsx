"use client";

import { useState } from "react";
import { 
  Lock, Smartphone, ShieldCheck, Eye, EyeOff, KeyRound, 
  ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, Check, Zap, Shield
} from "lucide-react";
import { Button } from "@/components/ui/Button";

function calculatePasswordStrength(pass: string): { score: number; label: string; color: string; width: string } {
  if (!pass) return { score: 0, label: "", color: "bg-muted", width: "0%" };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score, label: "Weak", color: "bg-rose-500", width: "20%" };
  if (score === 2) return { score, label: "Fair", color: "bg-amber-500", width: "40%" };
  if (score === 3) return { score, label: "Good", color: "bg-sky-500", width: "70%" };
  return { score, label: "Strong", color: "bg-emerald-500", width: "100%" };
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

      setSuccess("Password updated successfully! An audit log entry has been recorded.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
          <Shield className="w-4 h-4" /> Account Protection
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Security Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account authentication credentials, password strength, and security preferences.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg flex items-center gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Password Protection</span>
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">Bcrypt Encrypted</p>
          <p className="text-[11px] text-muted-foreground">Salting & hashing with cost factor 12</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Audit Trail Logging</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-600">Active Monitoring</p>
          <p className="text-[11px] text-muted-foreground">IP & device context captured on edits</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-lg shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Session Protection</span>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-lg font-bold text-indigo-600">JWT Authorized</p>
          <p className="text-[11px] text-muted-foreground">Secure HTTP-only session tokens</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Change Password Form (2 cols) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Change Account Password</h2>
            </div>
            <span className="text-xs text-muted-foreground">Required every 90 days recommended</span>
          </div>

          <form onSubmit={handlePasswordChange} className="p-6 space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                  className="w-full h-10 pl-3 pr-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
                {passwordForm.newPassword && (
                  <span className={`text-xs font-bold ${
                    strength.label === "Weak" ? "text-rose-500" :
                    strength.label === "Fair" ? "text-amber-500" :
                    strength.label === "Good" ? "text-sky-500" : "text-emerald-500"
                  }`}>
                    {strength.label} Password
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  minLength={8}
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  placeholder="Minimum 8 characters"
                  className="w-full h-10 pl-3 pr-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {passwordForm.newPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${strength.color}`} 
                      style={{ width: strength.width }} 
                    />
                  </div>
                  <div className="grid grid-cols-2 text-[11px] text-muted-foreground gap-1">
                    <span className={passwordForm.newPassword.length >= 8 ? "text-emerald-600 font-medium flex items-center gap-1" : ""}>
                      {passwordForm.newPassword.length >= 8 ? "✓ At least 8 chars" : "• At least 8 chars"}
                    </span>
                    <span className={/[0-9]/.test(passwordForm.newPassword) ? "text-emerald-600 font-medium flex items-center gap-1" : ""}>
                      {/[0-9]/.test(passwordForm.newPassword) ? "✓ Contains number" : "• Contains number"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  placeholder="Re-enter new password"
                  className="w-full h-10 pl-3 pr-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                <p className="text-xs text-rose-500">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || (passwordForm.confirmPassword !== "" && passwordForm.newPassword !== passwordForm.confirmPassword)}
              className="w-full h-10 font-semibold gap-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
        </div>

        {/* Security Best Practices Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Security Checklist */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Security Checklist
            </h3>

            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Unique Password:</strong> Avoid using passwords shared across other websites.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Role Isolation:</strong> Ensure staff permissions align with least privilege principles.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span><strong>Audit Log Tracking:</strong> Security and login actions are recorded for administrative auditing.</span>
              </li>
            </ul>
          </div>

          {/* 2FA Status Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">Two-Factor Authentication</h4>
              </div>
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-semibold uppercase">Coming Soon</span>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Enhance account protection by requiring TOTP authenticator app verification codes upon sign-in.
              </p>
              <Button disabled variant="outline" size="sm" className="w-full text-xs cursor-not-allowed opacity-60">
                Enable 2FA Authenticator
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

