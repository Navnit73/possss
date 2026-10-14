"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export default function AddSupplierPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    try {
      await axios.post("/api/suppliers", formData);
      router.push("/dashboard/suppliers");
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create supplier");
      // Only re-enable on failure; on success we're navigating away (prevents a double submit in between)
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell className="max-w-4xl">
      <PageHeader 
        title="Add Supplier"
        description="Create a new supplier profile."
        backHref={"/dashboard/suppliers"}
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Supplier Name *</Label>
              <Input
                id="supplier-name"
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. PharmaCorp Inc."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. contact@pharmacorp.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone Number</Label>
              <Input
                id="supplier-phone"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="e.g. +1 234 567 8900"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Textarea
                id="supplier-address"
                name="address"
                rows={3}
                value={formData.address}
                onChange={handleChange}
                placeholder="Full address of the supplier"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={"/dashboard/suppliers"} className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {!isSubmitting && <Save aria-hidden="true" />}
            {isSubmitting ? "Saving..." : "Save Supplier"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
