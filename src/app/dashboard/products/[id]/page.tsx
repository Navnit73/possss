"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { 
  Edit, 
  Package, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Plus, 
  Tag, 
  Building2, 
  CheckCircle2, 
  XCircle,
  Layers,
  Thermometer,
  Boxes,
  MapPin,
  Percent
} from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

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
        setError(err.response?.data?.error || "Failed to fetch product details");
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchProduct();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-md w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-slate-100 rounded-lg"></div>
          <div className="h-48 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <div className="p-4 text-sm text-rose-600 bg-rose-50 rounded-lg border border-rose-200 font-medium">
          {error || "Product not found"}
        </div>
        <Link href="/dashboard/products">
          <Button variant="outline">Return to Products Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <PageHeader 
        title={product.name}
        description={product.generic_name ? `Generic Name: ${product.generic_name}` : "Product Details Catalog Master"}
        backHref="/dashboard/products"
        actions={
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/inventory/add-stock?product_id=${id}`}>
              <Button variant="outline" className="gap-2 border-slate-200 text-slate-800 hover:bg-slate-100">
                <Plus className="w-4 h-4" /> Receive Stock
              </Button>
            </Link>
            <Link href={`/dashboard/products/${id}/edit`}>
              <Button className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                <Edit className="w-4 h-4" /> Edit Product
              </Button>
            </Link>
          </div>
        }
      />

      {/* Highlights Summary Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">{product.name}</h2>
              {product.strength && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {product.strength}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Category: <span className="font-semibold text-slate-800">{product.category?.name || "Uncategorized"}</span>
              {product.manufacturer?.name && (
                <span className="ml-3">
                  Manufacturer: <span className="font-semibold text-slate-800">{product.manufacturer.name}</span>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {product.requires_prescription ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" /> Rx Prescription Required
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> OTC Product
            </span>
          )}

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            product.status === "ACTIVE" 
              ? "bg-slate-100 text-slate-800 border-slate-300" 
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            {product.status === "ACTIVE" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5" />}
            {product.status || "ACTIVE"}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Basic Product Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Tag className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Basic Master Info</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Category</span>
              <span className="font-semibold text-slate-900">{product.category?.name || "Uncategorized"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Manufacturer</span>
              <span className="font-semibold text-slate-900">{product.manufacturer?.name || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Generic Name</span>
              <span className="font-semibold text-slate-900">{product.generic_name || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Brand</span>
              <span className="font-semibold text-slate-900">{product.brand || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">SKU Code</span>
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-max block mt-0.5">
                {product.sku || "-"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Barcode</span>
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-max block mt-0.5">
                {product.barcode || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Clinical & Administration */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Clinical & Pharmacology</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 font-medium block">Strength</span>
              <span className="font-semibold text-slate-900">{product.strength || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Dosage Form</span>
              <span className="font-semibold text-slate-900">{product.dosage_form || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Route of Administration</span>
              <span className="font-semibold text-slate-900">{product.route_of_administration || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Storage Conditions</span>
              <span className="font-semibold text-slate-900">{product.storage_conditions || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Pregnancy Category</span>
              <span className="font-semibold text-slate-900">{product.pregnancy_category || "-"}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">Prescription Mandatory</span>
              <span className={`font-bold ${product.requires_prescription ? 'text-rose-600' : 'text-emerald-700'}`}>
                {product.requires_prescription ? "Yes (Rx Required)" : "No (Over The Counter)"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-slate-500 font-medium block">Active Ingredients</span>
              <span className="font-semibold text-slate-900">{product.active_ingredients || "-"}</span>
            </div>
          </div>
        </div>

        {/* 3. Regulatory & Packaging */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Boxes className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Regulatory & Packaging</h3>
          </div>

          <div className="space-y-3 text-sm divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500 font-medium">Schedule Classification</span>
              <span className="font-semibold text-slate-900">{product.schedule_class || "-"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">HSN Code</span>
              <span className="font-mono text-xs font-semibold text-slate-900">{product.hsn_code || "-"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">NDC Code</span>
              <span className="font-mono text-xs font-semibold text-slate-900">{product.ndc_code || "-"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Dispense Unit (UOM)</span>
              <span className="font-semibold text-slate-900">{product.unit_of_measure || "-"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Package Type</span>
              <span className="font-semibold text-slate-900">{product.package_type || "-"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Package Size</span>
              <span className="font-semibold text-slate-900">{product.package_size || 1} units</span>
            </div>
          </div>
        </div>

        {/* 4. Inventory Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-900">Inventory & Tax Controls</h3>
          </div>

          <div className="space-y-3 text-sm divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500 font-medium">Rack / Shelf Location</span>
              <span className="font-semibold text-slate-900">{product.rack_number || "Unassigned"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Minimum Reorder Alert Threshold</span>
              <span className="font-bold text-slate-900">{product.minimum_stock || 0} units</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Applicable Tax Rate</span>
              <span className="font-semibold text-slate-900">{product.tax_rate || 0}%</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500 font-medium">Product Active Status</span>
              <span className={`font-bold ${product.status === "ACTIVE" ? 'text-emerald-700' : 'text-rose-600'}`}>
                {product.status || "ACTIVE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
