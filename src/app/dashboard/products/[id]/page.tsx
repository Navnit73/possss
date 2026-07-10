"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { useParams } from "next/navigation";

export default function ViewProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/api/products/${id}`);
        setProduct(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch product");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !product) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error || "Product not found"}</div>
        <Link href="/dashboard/products" className="mt-4 inline-block text-primary hover:underline">Return to Products</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard/products"
            className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">{product.name}</h1>
            <p className="text-muted-foreground mt-1">{product.generic_name || "No generic name"}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/products/${id}/edit`}
          className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-md hover:bg-primary/20 transition-colors font-medium"
        >
          <Edit className="w-4 h-4" />
          Edit Product
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-surface border border-border rounded-lg p-6  md:col-span-2">
          <h2 className="text-lg font-semibold mb-4 border-b border-border/50 pb-2">Basic Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-muted-foreground block">Category</span>
              <span className="font-medium">{product.category?.name || "Uncategorized"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Manufacturer</span>
              <span className="font-medium">{product.manufacturer?.name || "Unknown"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Generic Name</span>
              <span className="font-medium">{product.generic_name || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Brand</span>
              <span className="font-medium">{product.brand || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Barcode</span>
              <span className="font-medium">{product.barcode || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">SKU</span>
              <span className="font-medium">{product.sku || "-"}</span>
            </div>
          </div>
        </div>

        {/* Clinical & Administration */}
        <div className="bg-surface border border-border rounded-lg p-6  md:col-span-2">
          <h2 className="text-lg font-semibold mb-4 border-b border-border/50 pb-2">Clinical & Administration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-muted-foreground block">Strength</span>
              <span className="font-medium">{product.strength || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Dosage Form</span>
              <span className="font-medium">{product.dosage_form || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Route of Admin</span>
              <span className="font-medium">{product.route_of_administration || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Storage</span>
              <span className="font-medium">{product.storage_conditions || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Pregnancy Cat.</span>
              <span className="font-medium">{product.pregnancy_category || "-"}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground block">Requires Rx</span>
              <span className={`font-medium ${product.requires_prescription ? 'text-red-500' : 'text-green-500'}`}>
                {product.requires_prescription ? "Yes" : "No"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-sm text-muted-foreground block">Active Ingredients</span>
              <span className="font-medium">{product.active_ingredients || "-"}</span>
            </div>
          </div>
        </div>

        {/* Regulatory & Packaging */}
        <div className="bg-surface border border-border rounded-lg p-6 ">
          <h2 className="text-lg font-semibold mb-4 border-b border-border/50 pb-2">Regulatory & Packaging</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Schedule Class</span>
              <span className="font-medium">{product.schedule_class || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">HSN Code</span>
              <span className="font-medium">{product.hsn_code || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">NDC Code</span>
              <span className="font-medium">{product.ndc_code || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Dispense Unit (UOM)</span>
              <span className="font-medium">{product.unit_of_measure || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Package Type</span>
              <span className="font-medium">{product.package_type || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Package Size</span>
              <span className="font-medium">{product.package_size || 1} units</span>
            </div>
          </div>
        </div>

        {/* Inventory Settings */}
        {/* Inventory Settings */}
        <div className="bg-surface border border-border rounded-lg p-6 ">
          <h2 className="text-lg font-semibold mb-4 border-b border-border/50 pb-2">Inventory Settings</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Rack Number</span>
              <span className="font-medium">{product.rack_number || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Minimum Stock Alert</span>
              <span className="font-medium">{product.minimum_stock || 0} units</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tax Rate</span>
              <span className="font-medium">{product.tax_rate || 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`font-medium ${product.status === "ACTIVE" ? 'text-green-600' : 'text-red-500'}`}>
                {product.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
