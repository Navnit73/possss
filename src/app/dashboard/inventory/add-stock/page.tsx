"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { batchSchema } from "@/lib/validations";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import * as z from "zod";
import { format } from "date-fns";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

// Mirrors the server-side receiving rules in /api/inventory/batches
const receiveBatchSchema = batchSchema.extend({
  batch_number: z.string().trim().min(1, "Batch number is required").max(64, "Batch number is too long"),
  qty_available: z.coerce.number().finite().positive("Quantity received must be greater than zero").max(1_000_000, "Quantity is too large"),
  cost_price: z.coerce.number().finite().min(0, "Cost price cannot be negative").default(0),
  selling_price: z.coerce.number().finite().positive("Selling price must be greater than zero"),
});

type BatchFormType = z.infer<typeof receiveBatchSchema>;

export default function AddStockPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, setValue, control, watch, formState: { errors } } = useForm<BatchFormType>({
    resolver: zodResolver(receiveBatchSchema) as any,
    defaultValues: {
      product_id: "",
      qty_available: 0,
      cost_price: 0,
      selling_price: 0,
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, suppRes] = await Promise.all([
          axios.get("/api/products"),
          axios.get("/api/suppliers")
        ]);
        const prodData = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.products || [];
        const suppData = Array.isArray(suppRes.data) ? suppRes.data : suppRes.data?.suppliers || [];
        setProducts(prodData);
        setSuppliers(suppData);
        
        // Auto-select product if passed in URL
        const params = new URLSearchParams(window.location.search);
        const pid = params.get("product_id");
        if (pid) {
          setValue("product_id", pid);
          const found = prodData.find((p: any) => p._id === pid);
          if (found) {
            if (found.cost_price !== undefined) setValue("cost_price", Number(found.cost_price));
            if (found.selling_price !== undefined) setValue("selling_price", Number(found.selling_price));
          }
        }
      } catch (err: any) {
        console.error("Failed to load data", err);
        setError(err.response?.data?.error || "Failed to load products and suppliers");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [setValue]);

  // Auto populate prices when product changes
  const handleProductChange = (val: string, onChange: (v: string) => void) => {
    onChange(val);
    const found = products.find((p: any) => p._id === val);
    if (found) {
      if (found.cost_price !== undefined && found.cost_price !== null) {
        setValue("cost_price", Number(found.cost_price));
      }
      if (found.selling_price !== undefined && found.selling_price !== null) {
        setValue("selling_price", Number(found.selling_price));
      }
    }
  };

  const watchCost = Number(watch("cost_price") || 0);
  const watchSelling = Number(watch("selling_price") || 0);
  const sellingBelowCost = watchSelling > 0 && watchCost > 0 && watchSelling < watchCost;
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const onSubmit = async (data: BatchFormType) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      await axios.post("/api/inventory/batches", {
        ...data,
        qty_available: Number(data.qty_available),
        cost_price: Number(data.cost_price || 0),
        selling_price: Number(data.selling_price || 0)
      });
      router.push("/dashboard/inventory/stock-list");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add stock");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Receive New Stock"
        description="Add a new batch of product to inventory."
        backHref="/dashboard/inventory/stock-list"
      />

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-surface border border-border rounded-lg p-6 ">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="text-sm font-medium text-foreground">Product *</label>
            <div className="mt-1.5">
              <Controller
                name="product_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={products.map((p: any) => ({ label: `${p.name} ${p.strength ? `(${p.strength})` : ""}`, value: p._id }))}
                    value={field.value}
                    onChange={(val) => handleProductChange(val, field.onChange)}
                    placeholder="Search and select product..."
                    disabled={isLoading}
                  />
                )}
              />
            </div>
            {errors.product_id && <p className="text-sm text-red-500 mt-1">{errors.product_id.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Batch Number *</label>
            <input 
              {...register("batch_number")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. BATCH-001"
            />
            {errors.batch_number && <p className="text-sm text-red-500 mt-1">{errors.batch_number.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Supplier</label>
            <div className="mt-1.5">
              <Controller
                name="supplier"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={suppliers.map((s: any) => ({ label: s.name, value: s._id }))}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Search and select supplier..."
                    disabled={isLoading}
                  />
                )}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Quantity Received *</label>
            <input 
              type="number"
              step="any"
              {...register("qty_available")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.qty_available && <p className="text-sm text-red-500 mt-1">{errors.qty_available.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Expiry Date</label>
            <input 
              type="date"
              min={todayStr}
              {...register("expiry_date")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.expiry_date && <p className="text-sm text-red-500 mt-1">{errors.expiry_date.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Cost Price</label>
            <input 
              type="number"
              step="0.01"
              min="0"
              {...register("cost_price")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.cost_price && <p className="text-sm text-red-500 mt-1">{errors.cost_price.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Selling Price *</label>
            <input 
              type="number"
              step="0.01"
              min="0"
              {...register("selling_price")}
              className="w-full mt-1.5 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {errors.selling_price && <p className="text-sm text-red-500 mt-1">{errors.selling_price.message}</p>}
            {!errors.selling_price && sellingBelowCost && (
              <p className="text-sm text-amber-600 mt-1">Selling price is below cost price — this batch will be sold at a loss.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
          <Link 
            href="/dashboard/inventory/stock-list"
            className="px-6 py-2.5 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
          >
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={isSubmitting || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? "Saving..." : "Add Stock"}
          </button>
        </div>
      </form>
    </div>
  );
}
