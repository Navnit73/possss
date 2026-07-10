"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema } from "@/lib/validations";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import * as z from "zod";

type ProductFormType = z.infer<typeof productSchema>;

interface ProductFormProps {
  initialData?: ProductFormType & { _id?: string };
  isEdit?: boolean;
}

export function ProductForm({ initialData, isEdit }: ProductFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormType>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: initialData || {
      requires_prescription: false,
      minimum_stock: 0,
      tax_rate: 0,
      status: "ACTIVE"
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cats, mans] = await Promise.all([
          axios.get("/api/categories"),
          axios.get("/api/manufacturers")
        ]);
        setCategories(cats.data);
        setManufacturers(mans.data);
      } catch (err) {
        console.error("Failed to load select data", err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const onSubmit = async (data: ProductFormType) => {
    setIsSubmitting(true);
    setError("");
    try {
      if (isEdit && initialData?._id) {
        await axios.put(`/api/products/${initialData._id}`, data);
      } else {
        await axios.post("/api/products", data);
      }
      router.push("/dashboard/products");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save product");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Basic Information */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Medicine Name *</label>
              <input 
                {...register("name")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Paracetamol 500mg Tablet"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Generic Name</label>
              <input 
                {...register("generic_name")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Acetaminophen"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Brand</label>
              <input 
                {...register("brand")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Tylenol"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Category *</label>
              <select 
                {...register("category_id")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                disabled={isLoadingData}
              >
                <option value="">Select Category...</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-sm text-red-500 mt-1">{errors.category_id.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Manufacturer *</label>
              <select 
                {...register("manufacturer_id")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                disabled={isLoadingData}
              >
                <option value="">Select Manufacturer...</option>
                {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
              {errors.manufacturer_id && <p className="text-sm text-red-500 mt-1">{errors.manufacturer_id.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Barcode (UPC/EAN)</label>
              <input 
                {...register("barcode")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Scan or enter barcode"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">SKU (Internal Code)</label>
              <input 
                {...register("sku")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. MED-001"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Medicine Details */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Medicine Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Strength</label>
              <input 
                {...register("strength")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 500mg, 10ml"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Dosage Form</label>
              <select 
                {...register("dosage_form")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="">Select Form...</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Ointment">Ointment</option>
                <option value="Drops">Drops</option>
                <option value="Inhaler">Inhaler</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2 flex items-center gap-3 mt-2">
              <input 
                type="checkbox"
                id="requires_prescription"
                {...register("requires_prescription")}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
              />
              <label htmlFor="requires_prescription" className="text-sm font-medium text-foreground select-none cursor-pointer">
                Requires Prescription (Rx)
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Inventory Settings */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border/50">Inventory Settings</h2>
          
          <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/10 text-sm text-primary/80">
            <strong>Note:</strong> Product Master does not store quantity. Stock levels are managed separately by receiving Inventory Batches.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground">Minimum Stock Alert</label>
              <input 
                type="number"
                {...register("minimum_stock")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Alerts when total stock falls below this level.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Tax Rate (%)</label>
              <input 
                type="number"
                step="0.01"
                {...register("tax_rate")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <select 
                {...register("status")}
                className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 pb-12">
          <Link 
            href="/dashboard/products"
            className="px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={isSubmitting || isLoadingData}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Saving..." : (isEdit ? "Update Product" : "Save Product")}
          </button>
        </div>
      </form>
    </div>
  );
}
