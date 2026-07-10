"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categorySchema } from "@/lib/validations";
import { Plus, Tags, Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/api/categories");
      setCategories(res.data);
    } catch (err: any) {
      console.error(err);
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground mt-1">Manage medicine categories (e.g. Antibiotics, Painkillers).</p>
        </div>
        {!isAdding && (
          <Button
            onClick={() => {
              setEditingId(null);
              reset({ name: "", description: "" });
              setIsAdding(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        )}
      </div>

      {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-foreground mb-6">
              {editingId ? "Edit Category" : "New Category"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  {...register("name")}
                  placeholder="e.g. Antibiotics"
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea 
                  {...register("description")}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  placeholder="Optional description..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingId ? "Update Category" : "Save Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={3} rows={5} />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Tags className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No categories yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Add your first category to start organizing your pharmacy inventory.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="p-4 text-sm font-semibold text-foreground">Name</th>
                <th className="p-4 text-sm font-semibold text-foreground">Description</th>
                <th className="p-4 text-sm font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) => (
                <tr key={cat._id} className="hover:bg-secondary/30 transition-colors group">
                  <td className="p-4 text-sm font-medium text-foreground">{cat.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{cat.description || "-"}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleEditClick(cat)}
                      className="inline-flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Edit Category"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
