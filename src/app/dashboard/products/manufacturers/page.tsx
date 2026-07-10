"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manufacturerSchema } from "@/lib/validations";
import { Plus, Factory } from "lucide-react";

type ManufacturerForm = {
  name: string;
  contact_info?: string;
};

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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

  const onSubmit = async (data: ManufacturerForm) => {
    setError("");
    try {
      await axios.post("/api/manufacturers", data);
      reset();
      setIsAdding(false);
      fetchManufacturers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add manufacturer");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Manufacturers</h1>
          <p className="text-muted-foreground mt-1">Manage pharmaceutical manufacturers and suppliers.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Manufacturer
        </button>
      </div>

      {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md border border-red-200">{error}</div>}

      {isAdding && (
        <div className="bg-surface border border-border p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-4">New Manufacturer</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <div>
              <label className="text-sm font-medium text-foreground">Name *</label>
              <input 
                {...register("name")}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Pfizer"
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contact Info</label>
              <textarea 
                {...register("contact_info")}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Optional contact details..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Save Manufacturer
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading manufacturers...</div>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {manufacturers.map((man) => (
                <tr key={man._id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-4 text-sm font-medium text-foreground">{man.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{man.contact_info || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
