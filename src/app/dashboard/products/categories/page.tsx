"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema } from "@/lib/validations";
import { Plus, Tags, Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell, EmptyState } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

type CategoryForm = {
  name: string;
  description?: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/categories");
      setCategories(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleEditClick = (cat: any) => {
    setEditingId(cat._id);
    reset({
      name: cat.name,
      description: cat.description || "",
    });
    setIsAdding(true);
    setError("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    reset({ name: "", description: "" });
    setError("");
  };

  const onSubmit = async (data: CategoryForm) => {
    setError("");
    try {
      if (editingId) {
        await axios.put(`/api/categories/${editingId}`, data);
      } else {
        await axios.post("/api/categories", data);
      }
      handleCancel();
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingId ? "update" : "add"} category`);
    }
  };

  return (
    <PageShell>
      <PageHeader 
        title="Categories"
        description="Manage medicine categories (e.g. Antibiotics, Painkillers)."
        actions={
          !isAdding && (
            <Button
              onClick={() => {
                setEditingId(null);
                reset({ name: "", description: "" });
                setIsAdding(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add Category
            </Button>
          )
        }
      />

      {error && !isAdding && <Alert variant="destructive">{error}</Alert>}

      <Modal
        isOpen={isAdding}
        onClose={handleCancel}
        title={editingId ? "Edit Category" : "New Category"}
        className="max-w-md"
      >
        {/* Shown inside the modal: the page-level banner is hidden behind the overlay */}
        {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name *</Label>
            <Input 
              id="category-name"
              {...register("name")}
              placeholder="e.g. Antibiotics"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-caption text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea 
              id="category-description"
              {...register("description")}
              className="resize-none"
              placeholder="Optional description..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editingId ? "Update Category" : "Save Category"}
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={3} rows={5} />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            description="Add your first category to start organizing your pharmacy inventory."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat._id}>
                  <TableCell className="font-semibold text-ink">{cat.name}</TableCell>
                  <TableCell className="text-ink-48">{cat.description || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(cat)}
                      title="Edit Category"
                      aria-label="Edit Category"
                    >
                      <Edit aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
