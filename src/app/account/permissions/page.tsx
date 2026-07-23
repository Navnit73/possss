"use client";

import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, Check, X, Search, CheckSquare, Square, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Button } from "@/components/ui/Button";

const AVAILABLE_MODULES = [
  "POS",
  "CUSTOMERS",
  "PRODUCTS",
  "INVENTORY",
  "SALES",
  "REPORTS",
  "USERS",
  "ROLES",
  "SETTINGS"
];

const AVAILABLE_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE"];

const PRESETS = [
  {
    name: "Senior Pharmacist",
    description: "Full access to POS, Inventory, Products, Sales, and Customer Records",
    permissions: [
      { module: "POS", action: "VIEW" }, { module: "POS", action: "CREATE" }, { module: "POS", action: "EDIT" },
      { module: "CUSTOMERS", action: "VIEW" }, { module: "CUSTOMERS", action: "CREATE" }, { module: "CUSTOMERS", action: "EDIT" },
      { module: "PRODUCTS", action: "VIEW" }, { module: "PRODUCTS", action: "CREATE" }, { module: "PRODUCTS", action: "EDIT" },
      { module: "INVENTORY", action: "VIEW" }, { module: "INVENTORY", action: "CREATE" }, { module: "INVENTORY", action: "EDIT" },
      { module: "SALES", action: "VIEW" }, { module: "REPORTS", action: "VIEW" }
    ]
  },
  {
    name: "Cashier Lead",
    description: "Access to POS Checkout, Customer Info, and Daily Sales Viewing",
    permissions: [
      { module: "POS", action: "VIEW" }, { module: "POS", action: "CREATE" },
      { module: "CUSTOMERS", action: "VIEW" }, { module: "CUSTOMERS", action: "CREATE" },
      { module: "PRODUCTS", action: "VIEW" },
      { module: "SALES", action: "VIEW" }
    ]
  },
  {
    name: "Inventory Manager",
    description: "Manage Stock, Batches, Products, Suppliers, and Purchasing",
    permissions: [
      { module: "PRODUCTS", action: "VIEW" }, { module: "PRODUCTS", action: "CREATE" }, { module: "PRODUCTS", action: "EDIT" }, { module: "PRODUCTS", action: "DELETE" },
      { module: "INVENTORY", action: "VIEW" }, { module: "INVENTORY", action: "CREATE" }, { module: "INVENTORY", action: "EDIT" }, { module: "INVENTORY", action: "DELETE" },
      { module: "REPORTS", action: "VIEW" }
    ]
  }
];

export default function PermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load roles");
      setRoles(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRole._id ? `/api/roles/${editingRole._id}` : "/api/roles";
      const method = editingRole._id ? "PUT" : "POST";

      const payload = {
        name: editingRole.name,
        description: editingRole.description,
        permissions: editingRole.permissions || []
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save role");

      setEditingRole(null);
      Swal.fire({
        title: editingRole._id ? "Role Updated" : "Role Created",
        text: `Permissions for ${editingRole.name} updated successfully.`,
        icon: "success",
        timer: 1800,
        showConfirmButton: false
      });
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (role: any) => {
    const confirm = await Swal.fire({
      title: `Delete ${role.name}?`,
      text: "Users assigned to this role must be reassigned before deleting.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Yes, Delete Role"
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`/api/roles/${role._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        Swal.fire("Deleted!", "Role has been removed.", "success");
        fetchRoles();
      } catch (err: any) {
        Swal.fire("Delete Failed", String(err.message), "error");
      }
    }
  };

  const togglePermission = (module: string, action: string) => {
    const permissions = [...(editingRole.permissions || [])];
    const index = permissions.findIndex(p => p.module === module && p.action === action);
    
    if (index >= 0) {
      permissions.splice(index, 1);
    } else {
      permissions.push({ module, action });
    }
    
    setEditingRole({ ...editingRole, permissions });
  };

  const hasPermission = (module: string, action: string) => {
    return (editingRole?.permissions || []).some((p: any) => p.module === module && p.action === action);
  };

  // Toggle entire module row
  const toggleModuleRow = (module: string) => {
    const permissions = [...(editingRole?.permissions || [])];
    const allRowSelected = AVAILABLE_ACTIONS.every(action => hasPermission(module, action));

    let updated = permissions.filter(p => p.module !== module);
    if (!allRowSelected) {
      AVAILABLE_ACTIONS.forEach(action => {
        updated.push({ module, action });
      });
    }
    setEditingRole({ ...editingRole, permissions: updated });
  };

  // Toggle entire action column
  const toggleActionColumn = (action: string) => {
    const permissions = [...(editingRole?.permissions || [])];
    const allColSelected = AVAILABLE_MODULES.every(module => hasPermission(module, action));

    let updated = permissions.filter(p => p.action !== action);
    if (!allColSelected) {
      AVAILABLE_MODULES.forEach(module => {
        updated.push({ module, action });
      });
    }
    setEditingRole({ ...editingRole, permissions: updated });
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setEditingRole({
      ...editingRole,
      name: editingRole.name || preset.name,
      description: editingRole.description || preset.description,
      permissions: [...preset.permissions]
    });
  };

  const filteredRoles = roles.filter(r => 
    r.name?.toLowerCase().includes(search.toLowerCase()) || 
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Shield className="w-4 h-4" /> Access Control Matrix
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Configure custom roles and fine-grained module access rights for store staff.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setEditingRole({ name: "", description: "", permissions: [] })}
            className="gap-2 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Create Custom Role
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {editingRole ? (
        /* Edit / Create Role Form Modal / Drawer */
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-6 py-4 border-b border-border bg-muted/40 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-foreground text-base">
                {editingRole._id ? `Edit Role: ${editingRole.name}` : "Create New Custom Role"}
              </h2>
            </div>
            <button 
              onClick={() => setEditingRole(null)} 
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveRole} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role Name *</label>
                <input
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium text-foreground"
                  placeholder="e.g. Senior Pharmacist"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={editingRole.description || ""}
                  onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                  className="w-full h-10 px-3.5 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium text-foreground"
                  placeholder="Brief role summary..."
                />
              </div>
            </div>

            {/* Role Preset Quick Select */}
            <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-primary" /> Apply Quick Template Preset
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 bg-background border border-border hover:border-primary/50 text-foreground hover:text-primary text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({preset.permissions.length} perms)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Permissions Matrix</h3>
                <span className="text-xs text-primary font-bold bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {editingRole.permissions?.length || 0} Permissions Selected
                </span>
              </div>

              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground">
                      <th className="px-4 py-3 w-1/3">Module / Entity</th>
                      {AVAILABLE_ACTIONS.map(action => (
                        <th key={action} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleActionColumn(action)}
                            className="inline-flex items-center gap-1 text-xs font-bold hover:text-primary transition-colors cursor-pointer"
                            title={`Select/Deselect all ${action} permissions`}
                          >
                            <span>{action}</span>
                            <CheckSquare className="w-3.5 h-3.5 text-muted-foreground/60" />
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center">Batch Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {AVAILABLE_MODULES.map(module => {
                      const allRowSelected = AVAILABLE_ACTIONS.every(action => hasPermission(module, action));
                      return (
                        <tr key={module} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground text-xs">{module}</td>
                          {AVAILABLE_ACTIONS.map(action => (
                            <td key={`${module}-${action}`} className="px-4 py-3 text-center">
                              <label className="inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="sr-only peer"
                                  checked={hasPermission(module, action)}
                                  onChange={() => togglePermission(module, action)}
                                />
                                <div className="w-5 h-5 border-2 border-border rounded-md peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-colors">
                                  {hasPermission(module, action) && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                                </div>
                              </label>
                            </td>
                          ))}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleModuleRow(module)}
                              className="text-xs text-muted-foreground hover:text-primary font-semibold transition-colors cursor-pointer"
                            >
                              {allRowSelected ? "Deselect Row" : "Select Row"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="font-semibold">
                Save Role & Permissions
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* Roles List Table */
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col shadow-2xs">
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search custom roles by name or description..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs font-medium transition-all"
              />
            </div>
            <div className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
              Total Roles: {roles.length}
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <TableSkeleton columns={4} rows={4} />
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <Shield className="w-7 h-7 opacity-40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No custom roles found</h3>
              <p className="text-muted-foreground text-xs max-w-sm mb-4">
                {search ? "Try adjusting your search terms." : "Create custom roles to assign granular access to your staff."}
              </p>
              <Button onClick={() => setEditingRole({ name: "", description: "", permissions: [] })} size="sm">
                Create First Role
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Role Name</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Assigned Permissions</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredRoles.map((role) => (
                    <tr key={role._id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4 font-semibold text-foreground">{role.name}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{role.description || "-"}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          {role.permissions?.length || 0} Allowed Rights
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRole(role)}
                            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(role)}
                            className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

