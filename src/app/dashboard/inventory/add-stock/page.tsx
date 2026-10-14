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
import { PageShell } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
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
    <PageShell>
      <PageHeader 
        title="Receive New Stock"
        description="Add a new batch of product to inventory."
        backHref="/dashboard/inventory/stock-list"
      />

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card className="p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <Label>Product *</Label>
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
            {errors.product_id && <p className="text-caption text-destructive mt-1.5">{errors.product_id.message}</p>}
          </div>

          <div>
            <Label>Batch Number *</Label>
            <Input 
              {...register("batch_number")}
              className="mt-1.5"
              placeholder="e.g. BATCH-001"
            />
            {errors.batch_number && <p className="text-caption text-destructive mt-1.5">{errors.batch_number.message}</p>}
          </div>

          <div>
            <Label>Supplier</Label>
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
            <Label>Quantity Received *</Label>
            <Input 
              type="number"
              step="any"
              {...register("qty_available")}
              className="mt-1.5"
            />
            {errors.qty_available && <p className="text-caption text-destructive mt-1.5">{errors.qty_available.message}</p>}
          </div>

          <div>
            <Label>Expiry Date</Label>
            <Input 
              type="date"
              min={todayStr}
              {...register("expiry_date")}
              className="mt-1.5"
            />
            {errors.expiry_date && <p className="text-caption text-destructive mt-1.5">{errors.expiry_date.message}</p>}
          </div>

          <div>
            <Label>Cost Price</Label>
            <Input 
              type="number"
              step="0.01"
              min="0"
              {...register("cost_price")}
              className="mt-1.5"
            />
            {errors.cost_price && <p className="text-caption text-destructive mt-1.5">{errors.cost_price.message}</p>}
          </div>

          <div>
            <Label>Selling Price *</Label>
            <Input 
              type="number"
              step="0.01"
              min="0"
              {...register("selling_price")}
              className="mt-1.5"
            />
            {errors.selling_price && <p className="text-caption text-destructive mt-1.5">{errors.selling_price.message}</p>}
            {!errors.selling_price && sellingBelowCost && (
              <p className="text-caption text-warning mt-1.5">Selling price is below cost price — this batch will be sold at a loss.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-hairline">
          <Link 
            href="/dashboard/inventory/stock-list"
            className={buttonClasses({ variant: "outline" })}
          >
            Cancel
          </Link>
          <Button 
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            <Plus aria-hidden="true" />
            {isSubmitting ? "Saving..." : "Add Stock"}
          </Button>
        </div>
      </form>
      </Card>
    </PageShell>
  );
}
