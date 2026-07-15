"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { customerSchema } from "@/lib/validations";
import type { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

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
    resolver: zodResolver(customerSchema),
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/customers" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Customer</h1>
          <p className="text-muted-foreground text-sm">Create a new customer profile</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border shadow-sm p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Full Name *</label>
              <input
                {...register("name")}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Phone Number</label>
              <input
                {...register("phone")}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Email Address</label>
              <input
                {...register("email")}
                type="email"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date of Birth</label>
              <input
                {...register("date_of_birth")}
                type="date"
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-foreground">Address</label>
              <textarea
                {...register("address")}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Full address"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-foreground">Notes</label>
              <textarea
                {...register("notes")}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Any special requirements or notes"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Status</label>
              <select
                {...register("status")}
                className="w-full px-3 py-2 border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Custom Customer ID</label>
              <input
                {...register("customer_id")}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Leave blank to auto-generate"
              />
              {errors.customer_id && <p className="text-red-500 text-xs">{errors.customer_id.message}</p>}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <Link
              href="/dashboard/customers"
              className="px-4 py-2 border border-border text-foreground/80 rounded-md font-medium text-sm hover:bg-surface"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
