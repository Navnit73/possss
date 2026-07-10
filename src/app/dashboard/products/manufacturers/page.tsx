"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manufacturerSchema } from "@/lib/validations";
import { Plus, Factory, Edit } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

type ManufacturerForm = {
  name: string;
  contact_info?: string;
};

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ManufacturerForm>({
    resolver: zodResolver(manufacturerSchema),
  });

  const fetchManufacturers = async () => {
    try {
      const res = await axios.get("/api/manufacturers");
      setManufacturers(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchManufacturers();
  }, []);

  const handleEditClick = (man: any) => {
    setEditingId(man._id);
    reset({
      name: man.name,
      contact_info: man.contact_info || "",
    });
    setIsAdding(true);
    setError("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    reset({ name: "", contact_info: "" });
    setError("");
  };

  const onSubmit = async (data: ManufacturerForm) => {
    setError("");
    try {
      if (editingId) {
        await axios.put(`/api/manufacturers/${editingId}`, data);
      } else {
        await axios.post("/api/manufacturers", data);
      }
      handleCancel();
      fetchManufacturers();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingId ? "update" : "add"} manufacturer`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Manufacturers</h1>
          <p className="text-muted-foreground mt-1">Manage pharmaceutical manufacturers and suppliers.</p>
        </div>
        {!isAdding && (
          <Button
            onClick={() => {
              setEditingId(null);
              reset({ name: "", contact_info: "" });
              setIsAdding(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Manufacturer
          </Button>
        )}
      </div>

      {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border p-6 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-foreground mb-6">
              {editingId ? "Edit Manufacturer" : "New Manufacturer"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input 
                  {...register("name")}
                  placeholder="e.g. Pfizer"
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Contact Info</Label>
                <textarea 
                  {...register("contact_info")}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  placeholder="Optional contact details..."
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
                  {editingId ? "Update Manufacturer" : "Save Manufacturer"}
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
        ) : manufacturers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Factory className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">No manufacturers yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Add your first manufacturer to start tracking medicine origins.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="p-4 text-sm font-semibold text-foreground">Name</th>
                <th className="p-4 text-sm font-semibold text-foreground">Contact Info</th>
                <th className="p-4 text-sm font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {manufacturers.map((man) => (
                <tr key={man._id} className="hover:bg-secondary/30 transition-colors group">
                  <td className="p-4 text-sm font-medium text-foreground">{man.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{man.contact_info || "-"}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleEditClick(man)}
                      className="inline-flex items-center justify-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Edit Manufacturer"
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
