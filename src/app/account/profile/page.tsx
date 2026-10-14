"use client";

import { useState, useEffect } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { z } from "zod";
import { useCurrency } from "@/context/CurrencyContext";

import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { COUNTRIES, TIMEZONES } from "@/lib/regions";

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ label: c.name, value: c.name }));

const CURRENCIES = SUPPORTED_CURRENCIES.map((c) => ({
  label: `${c.code} - ${c.name} (${c.symbol})`,
  value: c.code,
}));

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
          setCurrency(data.tenant.currency, false);
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

      // PUT above already saved it on the tenant (owners only)
      if (parsedTenant?.currency) {
        setCurrency(parsedTenant.currency, false);
      }

      setSuccess("Profile and store information updated successfully!");
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message ?? "Please check the form and try again");
      } else {
        setError(err.message || "Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Card className="p-6">
          <TableSkeleton columns={2} rows={4} />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Account Profile"
        description="Manage your user profile credentials, contact information, and store business settings."
      />

      {/* Notifications */}
      {error && (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <span>{success}</span>
        </Alert>
      )}

      {/* User Summary Card */}
      <Card className="p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="size-16 rounded-full bg-parchment text-ink text-tagline flex items-center justify-center shrink-0">
          {userForm.name ? userForm.name.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="space-y-1 text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-tagline text-ink">{userForm.name || "User Account"}</h2>
            <Badge variant={userRole === "OWNER" ? "dark" : "secondary"} className="w-fit mx-auto sm:mx-0">
              {userRole}
            </Badge>
          </div>
          <p className="text-caption text-ink-48">{userForm.email}</p>
        </div>
      </Card>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>

          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full name *</Label>
              <Input
                id="profile-name"
                type="text"
                required
                value={userForm.name}
                onChange={e => setUserForm({...userForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Email address (read only)</Label>
              <Input
                id="profile-email"
                type="email"
                value={userForm.email}
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input
                id="profile-phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={userForm.phone}
                onChange={e => setUserForm({...userForm, phone: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-job-title">Job title</Label>
              <Input
                id="profile-job-title"
                type="text"
                placeholder="e.g. Chief Pharmacist"
                value={userForm.job_title}
                onChange={e => setUserForm({...userForm, job_title: e.target.value})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Information (Owner Only) */}
        {userRole === "OWNER" && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>Pharmacy &amp; Store Settings</CardTitle>
              <Badge variant="secondary">Owner access only</Badge>
            </CardHeader>

            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="tenant-business-name">Pharmacy business name *</Label>
                <Input
                  id="tenant-business-name"
                  type="text"
                  required
                  value={tenantForm.business_name}
                  onChange={e => setTenantForm({...tenantForm, business_name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label id="tenant-country-label">Country</Label>
                <SearchableSelect
                  aria-labelledby="tenant-country-label"
                  options={COUNTRY_OPTIONS}
                  value={tenantForm.country}
                  onChange={val => setTenantForm({...tenantForm, country: val})}
                  placeholder="Select Country"
                />
              </div>

              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="tenant-address">Business physical address</Label>
                <Textarea
                  id="tenant-address"
                  value={tenantForm.address}
                  onChange={e => setTenantForm({...tenantForm, address: e.target.value})}
                  className="resize-none"
                  rows={3}
                  placeholder="Store address..."
                />
              </div>

              <div className="space-y-2">
                <Label id="tenant-currency-label">Store currency</Label>
                <SearchableSelect
                  aria-labelledby="tenant-currency-label"
                  options={CURRENCIES}
                  value={tenantForm.currency}
                  onChange={val => setTenantForm({...tenantForm, currency: val})}
                  placeholder="Select Currency"
                />
              </div>

              <div className="space-y-2">
                <Label id="tenant-timezone-label">Store timezone</Label>
                <SearchableSelect
                  aria-labelledby="tenant-timezone-label"
                  options={TIMEZONES}
                  value={tenantForm.timezone}
                  onChange={val => setTenantForm({...tenantForm, timezone: val})}
                  placeholder="Select Timezone"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            {saving ? "Saving Changes..." : "Save Profile & Store Settings"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
