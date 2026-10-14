"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { customerSchema } from "@/lib/validations";
import type { z } from "zod";
import Link from "next/link";
import { Save } from "lucide-react";
import { PageShell } from "@/components/ui/Page";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type CustomerFormData = z.infer<typeof customerSchema>;

export default function AddCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema) as any,
    defaultValues: {
      status: "ACTIVE",
    },
  });

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    setError("");
    try {
      await axios.post("/api/customers", data);
      router.push("/dashboard/customers");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Add New Customer"
        description="Create a new customer profile"
        backHref={"/dashboard/customers"}
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Full Name *</Label>
              <Input
                id="customer-name"
                {...register("name")}
                aria-invalid={!!errors.name}
                placeholder="John Doe"
              />
              {errors.name && <p className="text-caption text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number</Label>
              <Input
                id="customer-phone"
                {...register("phone")}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-email">Email Address</Label>
              <Input
                id="customer-email"
                {...register("email")}
                type="email"
                aria-invalid={!!errors.email}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-caption text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-date_of_birth">Date of Birth</Label>
              <Input
                id="customer-date_of_birth"
                {...register("date_of_birth")}
                type="date"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                {...register("address")}
                rows={2}
                placeholder="Full address"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="customer-status">Status</Label>
              <Select
                id="customer-status"
                {...register("status")}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-customer_id">Custom Customer ID</Label>
              <Input
                id="customer-customer_id"
                {...register("customer_id")}
                aria-invalid={!!errors.customer_id}
                placeholder="Leave blank to auto-generate"
              />
              {errors.customer_id && <p className="text-caption text-destructive">{errors.customer_id.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                {...register("notes")}
                rows={3}
                placeholder="Any special requirements or notes"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={"/dashboard/customers"} className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {!isSubmitting && <Save aria-hidden="true" />}
            Save Customer
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
