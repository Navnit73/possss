"use client";

import { useState, useEffect, use } from "react";
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
import { Spinner } from "@/components/ui/Spinner";

export default function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // If the supplier couldn't be loaded, saving would overwrite it with an empty form
  const [loadFailed, setLoadFailed] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await axios.get(`/api/suppliers/${id}`);
        const supplier = res.data;
        setFormData({
          name: supplier.name || "",
          phone: supplier.phone || "",
          email: supplier.email || "",
          address: supplier.address || "",
        });
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch supplier details.");
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

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
      await axios.put(`/api/suppliers/${id}`, formData);
      router.push("/dashboard/suppliers");
      router.refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update supplier");
      // Only re-enable on failure; on success we're navigating away (prevents a double submit in between)
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-2.75rem)] flex-col items-center justify-center gap-3">
        <Spinner label="" />
        <p className="text-caption text-ink-48">Loading supplier details...</p>
      </div>
    );
  }

  return (
    <PageShell className="max-w-4xl">
      <PageHeader 
        title="Edit Supplier"
        description="Update supplier information."
        backHref={`/dashboard/suppliers/${id}`}
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
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/dashboard/suppliers/${id}`} className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={loadFailed} loading={isSubmitting}>
            {!isSubmitting && <Save aria-hidden="true" />}
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
