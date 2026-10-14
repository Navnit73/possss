"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Spinner } from "@/components/ui/Spinner";
import Swal from "@/lib/swal";

type CustomerFormData = z.infer<typeof customerSchema>;

export default function EditCustomerPage() {
  const router = useRouter();
  const { id } = useParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema) as any,
    defaultValues: {
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await axios.get(`/api/customers/${id}`);
        // Remove strictly internal DB fields from being pushed to the form, though zod ignores them anyway
        reset(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load customer");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCustomer();
  }, [id, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    setError("");
    try {
      await axios.put(`/api/customers/${id}`, data);
      await Swal.fire('Success', 'Customer updated successfully', 'success');
      router.refresh();
      router.push(`/dashboard/customers/${id}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to update customer";
      setError(errorMsg);
      Swal.fire('Error', errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-2.75rem)] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Edit Customer"
        description="Update customer profile details"
        backHref={`/dashboard/customers/${id}`}
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
                  readOnly // We usually shouldn't let them edit ID easily or it breaks links if they manually type things, but schema allows it. Actually readOnly is safer so it submits.
                  className="bg-parchment text-ink-48"
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
          <Link href={`/dashboard/customers/${id}`} className={buttonClasses({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" loading={isSubmitting}>
            {!isSubmitting && <Save aria-hidden="true" />}
            Update Customer
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
