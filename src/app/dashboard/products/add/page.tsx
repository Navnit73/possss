"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AddProductPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Add Product"
        description="Create a new entry in your medicine master catalog."
        backHref="/dashboard/products"
      />

      <ProductForm />
    </div>
  );
}
