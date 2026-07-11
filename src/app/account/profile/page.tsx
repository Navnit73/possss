"use client";

import { useState, useEffect } from "react";
import { User, Store, Mail, Phone, MapPin, Globe, CreditCard } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { z } from "zod";

const COUNTRIES = [
  { label: "United States", value: "United States" },
  { label: "India", value: "India" },
  { label: "United Kingdom", value: "United Kingdom" },
  { label: "Canada", value: "Canada" },
  { label: "Australia", value: "Australia" },
];

const CURRENCIES = [
  { label: "USD - US Dollar", value: "USD" },
  { label: "INR - Indian Rupee", value: "INR" },
  { label: "EUR - Euro", value: "EUR" },
  { label: "GBP - British Pound", value: "GBP" },
  { label: "AUD - Australian Dollar", value: "AUD" },
];

const TIMEZONES = [
  { label: "UTC", value: "UTC" },
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
];

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
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
    try {
      const res = await fetch("/api/account/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

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
      }
    } catch (err: any) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // Validate
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
      if (!res.ok) throw new Error(data.error);

      setSuccess("Profile updated successfully");
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
    return <div className="p-8">Loading profile...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Profile</h1>
        <p className="text-muted-foreground">Manage your personal and business information.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-sm">
          {success}
        </div>
      )}

      <div className="grid gap-8">
        {/* Personal Info */}
        <div className="bg-surface border border-border rounded-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center gap-2 rounded-t-sm">
            <User className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold">Personal Information</h2>
          </div>
          <div className="p-6 grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  value={userForm.email}
                  disabled
                  className="w-full h-10 px-3 bg-background/50 border border-border rounded-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number</label>
                <input
                  type="tel"
                  value={userForm.phone}
                  onChange={e => setUserForm({...userForm, phone: e.target.value})}
                  className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Title</label>
                <input
                  type="text"
                  value={userForm.job_title}
                  onChange={e => setUserForm({...userForm, job_title: e.target.value})}
                  className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Business Info (Only for Owners) */}
        {userRole === "OWNER" && (
          <div className="bg-surface border border-border rounded-sm">
            <div className="px-6 py-4 border-b border-border bg-muted/50 flex items-center gap-2 rounded-t-sm">
              <Store className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold">Business Information</h2>
            </div>
            <div className="p-6 grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pharmacy Name</label>
                  <input
                    type="text"
                    value={tenantForm.business_name}
                    onChange={e => setTenantForm({...tenantForm, business_name: e.target.value})}
                    className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <SearchableSelect
                    options={COUNTRIES}
                    value={tenantForm.country}
                    onChange={val => setTenantForm({...tenantForm, country: val})}
                    placeholder="Select Country"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium">Business Address</label>
                  <textarea
                    value={tenantForm.address}
                    onChange={e => setTenantForm({...tenantForm, address: e.target.value})}
                    className="w-full p-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors resize-none"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <SearchableSelect
                    options={CURRENCIES}
                    value={tenantForm.currency}
                    onChange={val => setTenantForm({...tenantForm, currency: val})}
                    placeholder="Select Currency"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <SearchableSelect
                    options={TIMEZONES}
                    value={tenantForm.timezone}
                    onChange={val => setTenantForm({...tenantForm, timezone: val})}
                    placeholder="Select Timezone"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
