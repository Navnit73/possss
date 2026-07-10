"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { useParams } from "next/navigation";

export default function EditProductPage() {
  const { id } = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/api/products/${id}`);
        setInitialData(res.data);
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

  if (error || !initialData) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error || "Product not found"}</div>
        <Link href="/dashboard/products" className="mt-4 inline-block text-primary hover:underline">Return to Products</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader 
        title="Edit Product"
        description="Update medicine details."
        backHref="/dashboard/products"
      />

      <ProductForm initialData={initialData} isEdit={true} />
    </div>
  );
}
