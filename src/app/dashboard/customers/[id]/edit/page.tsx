"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { customerSchema } from "@/lib/validations";
import type { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

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
    resolver: zodResolver(customerSchema),
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
      router.push(`/dashboard/customers/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/customers/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Customer</h1>
          <p className="text-muted-foreground text-sm">Update customer profile details</p>
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
                className="w-full px-3 py-2 border border-border rounded-md bg-surface text-muted-foreground focus:outline-none"
                placeholder="Leave blank to auto-generate"
                disabled // We usually shouldn't let them edit ID easily or it breaks links if they manually type things, but schema allows it. Actually disabled is safer.
              />
              {errors.customer_id && <p className="text-red-500 text-xs">{errors.customer_id.message}</p>}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex justify-end gap-3">
            <Link
              href={`/dashboard/customers/${id}`}
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
              Update Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
