"use client";

import { useState } from "react";
import { Lock, Smartphone, ShieldCheck } from "lucide-react";

export default function SecurityPage() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      const res = await fetch("/api/account/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">Manage your password and security preferences.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-sm flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          {success}
        </div>
      )}

      <div className="bg-surface border border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center gap-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="p-6 grid gap-6 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
              className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
              className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
              className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <div className="bg-surface border border-border rounded-sm overflow-hidden opacity-50">
        <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold">Two-Factor Authentication (2FA)</h2>
          </div>
          <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground font-medium uppercase">Coming Soon</span>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Add an extra layer of security to your account by requiring a verification code when signing in.
          </p>
          <button disabled className="px-4 py-2 border border-border rounded-sm font-medium cursor-not-allowed text-muted-foreground">
            Enable 2FA
          </button>
        </div>
      </div>
    </div>
  );
}
