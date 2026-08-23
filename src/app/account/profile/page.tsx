"use client";

import { useState, useEffect } from "react";
import { User, Store, Mail, Phone, MapPin, Globe, CreditCard, ShieldCheck, AlertCircle, RefreshCw, Briefcase, Building2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";
import { z } from "zod";
import { useCurrency } from "@/context/CurrencyContext";

import { SUPPORTED_CURRENCIES } from "@/lib/currency";

const COUNTRIES = [
  { label: "United States", value: "United States" },
  { label: "India", value: "India" },
  { label: "Ethiopia", value: "Ethiopia" },
  { label: "United Kingdom", value: "United Kingdom" },
  { label: "Canada", value: "Canada" },
  { label: "Australia", value: "Australia" },
];

const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => ({
  label: `${c.code} - ${c.name} (${c.symbol})`,
  value: c.code,
}));

const TIMEZONES = [
  { label: "US - Eastern Time", value: "America/New_York" },
  { label: "US - Central Time", value: "America/Chicago" },
  { label: "US - Mountain Time", value: "America/Denver" },
  { label: "US - Pacific Time", value: "America/Los_Angeles" },
  { label: "Canada - Eastern Time", value: "America/Toronto" },
  { label: "Canada - Pacific Time", value: "America/Vancouver" },
  { label: "UK - London", value: "Europe/London" },
  { label: "Australia - Sydney", value: "Australia/Sydney" },
  { label: "Australia - Melbourne", value: "Australia/Melbourne" },
  { label: "Australia - Perth", value: "Australia/Perth" },
  { label: "Ethiopia - Addis Ababa (EAT)", value: "Africa/Addis_Ababa" },
  { label: "India - IST", value: "Asia/Kolkata" },
  { label: "UTC", value: "UTC" },
];

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  language_preference: z.string().optional(),
  timezone: z.string().optional(),
});

const tenantSchema = z.object({
  business_name: z.string().min(2, "Business name is required"),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().optional(),
});

export default function ProfilePage() {
  const { setCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("CASHIER");
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    job_title: "",
    language_preference: "en",
    timezone: "UTC",
  });
  const [tenantForm, setTenantForm] = useState({
    business_name: "",
    country: "",
    currency: "",
    timezone: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");

      setUserForm({
        name: data.user.name || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        job_title: data.user.job_title || "",
        language_preference: data.user.language_preference || "en",
        timezone: data.user.timezone || "UTC",
      });
      setUserRole(data.user.role || "CASHIER");

      if (data.tenant) {
        setTenantForm({
          business_name: data.tenant.business_name || "",
          country: data.tenant.country || "",
          currency: data.tenant.currency || "",
          timezone: data.tenant.timezone || "",
          address: data.tenant.address || "",
        });
        if (data.tenant.currency) {
          setCurrency(data.tenant.currency);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const parsedUser = profileSchema.parse(userForm);
      let parsedTenant = null;
      if (userRole === "OWNER") {
        parsedTenant = tenantSchema.parse(tenantForm);
      }

      const payload = {
        user: parsedUser,
        ...(parsedTenant && { tenant: parsedTenant })
      };

      const res = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      if (tenantForm.currency) {
        setCurrency(tenantForm.currency);
      }

      setSuccess("Profile and store information updated successfully!");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError((err as any).errors[0].message);
      } else {
        setError(err.message || "Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="border-b border-border pb-6 space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
        <div className="p-6 bg-card border border-border rounded-lg space-y-4">
          <TableSkeleton columns={2} rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
          <User className="w-4 h-4" /> Personal & Business Identity
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your user profile credentials, contact information, and store business settings.
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

      {/* User Summary Card */}
      <div className="p-6 bg-card border border-border rounded-xl shadow-2xs flex flex-col sm:flex-row items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center shrink-0 border border-primary/20">
          {userForm.name ? userForm.name.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="space-y-1 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{userForm.name || "User Account"}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit mx-auto sm:mx-0 border ${
              userRole === "OWNER" 
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                : "bg-primary/10 text-primary border-primary/20"
            }`}>
              {userRole}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{userForm.email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-8">
        {/* Personal Information */}
        <div className="bg-card border border-border rounded-xl shadow-2xs">
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2 rounded-t-xl">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Personal Information</h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</label>
              <input
                type="text"
                required
                value={userForm.name}
                onChange={e => setUserForm({...userForm, name: e.target.value})}
                className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address (Read Only)</label>
              <input
                type="email"
                value={userForm.email}
                disabled
                className="w-full h-10 px-3.5 bg-muted/40 border border-border rounded-md text-muted-foreground cursor-not-allowed text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</label>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={userForm.phone}
                onChange={e => setUserForm({...userForm, phone: e.target.value})}
                className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job Title</label>
              <input
                type="text"
                placeholder="e.g. Chief Pharmacist"
                value={userForm.job_title}
                onChange={e => setUserForm({...userForm, job_title: e.target.value})}
                className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
              />
            </div>
          </div>
        </div>

        {/* Business Information (Owner Only) */}
        {userRole === "OWNER" && (
          <div className="bg-card border border-border rounded-xl shadow-2xs">
            <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Pharmacy & Store Settings</h2>
              </div>
              <span className="text-xs bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded font-semibold border border-amber-500/20">
                Owner Access Only
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pharmacy Business Name *</label>
                <input
                  type="text"
                  required
                  value={tenantForm.business_name}
                  onChange={e => setTenantForm({...tenantForm, business_name: e.target.value})}
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</label>
                <SearchableSelect
                  options={COUNTRIES}
                  value={tenantForm.country}
                  onChange={val => setTenantForm({...tenantForm, country: val})}
                  placeholder="Select Country"
                />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Business Physical Address</label>
                <textarea
                  value={tenantForm.address}
                  onChange={e => setTenantForm({...tenantForm, address: e.target.value})}
                  className="w-full p-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm text-foreground resize-none"
                  rows={3}
                  placeholder="Store address..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store Currency</label>
                <SearchableSelect
                  options={CURRENCIES}
                  value={tenantForm.currency}
                  onChange={val => setTenantForm({...tenantForm, currency: val})}
                  placeholder="Select Currency"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store Timezone</label>
                <SearchableSelect
                  options={TIMEZONES}
                  value={tenantForm.timezone}
                  onChange={val => setTenantForm({...tenantForm, timezone: val})}
                  placeholder="Select Timezone"
                />
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="px-8 h-10 font-semibold gap-2"
          >
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saving ? "Saving Changes..." : "Save Profile & Store Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

