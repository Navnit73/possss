"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import Link from "next/link";
import { ProductForm } from "@/components/products/ProductForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
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
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-3 py-16 text-caption text-ink-48">
          <Spinner label="" className="size-5" /> Loading...
        </div>
      </PageShell>
    );
  }

  if (error || !initialData) {
    return (
      <PageShell className="max-w-4xl">
        <Alert variant="destructive">{error || "Product not found"}</Alert>
        <Link href="/dashboard/products" className="text-link text-body">Return to Products</Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader 
        title="Edit Product"
        description="Update medicine details."
        backHref="/dashboard/products"
      />

      <ProductForm initialData={initialData} isEdit={true} />
    </PageShell>
  );
}
