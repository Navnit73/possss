"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, Check, X } from "lucide-react";
import clsx from "clsx";

const AVAILABLE_MODULES = [
  "PRODUCTS",
  "INVENTORY",
  "SALES",
  "REPORTS",
  "USERS",
  "ROLES",
  "SETTINGS"
];

const AVAILABLE_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE"];

export default function PermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoles(data);
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
      if (!res.ok) throw new Error(data.error);

      setEditingRole(null);
      fetchRoles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchRoles();
    } catch (err: any) {
      alert(err.message);
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
    return (editingRole.permissions || []).some((p: any) => p.module === module && p.action === action);
  };

  if (loading) return <div className="p-8">Loading roles...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground">Manage custom roles and access control.</p>
        </div>
        <button
          onClick={() => setEditingRole({ name: "", description: "", permissions: [] })}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Role
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm">
          {error}
        </div>
      )}

      {editingRole ? (
        <div className="bg-surface border border-border rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/50 flex justify-between items-center">
            <h2 className="font-semibold">{editingRole._id ? "Edit Role" : "New Role"}</h2>
            <button onClick={() => setEditingRole(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSaveRole} className="p-6 grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Role Name</label>
                <input
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={e => setEditingRole({...editingRole, name: e.target.value})}
                  className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary"
                  placeholder="e.g. Senior Pharmacist"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <input
                  type="text"
                  value={editingRole.description}
                  onChange={e => setEditingRole({...editingRole, description: e.target.value})}
                  className="w-full h-10 px-3 bg-background border border-border rounded-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Permissions Matrix</h3>
              <div className="border border-border rounded-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-medium text-muted-foreground w-1/3">Module</th>
                      {AVAILABLE_ACTIONS.map(action => (
                        <th key={action} className="px-4 py-3 font-medium text-muted-foreground text-center">{action}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-surface">
                    {AVAILABLE_MODULES.map(module => (
                      <tr key={module} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{module}</td>
                        {AVAILABLE_ACTIONS.map(action => (
                          <td key={`${module}-${action}`} className="px-4 py-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={hasPermission(module, action)}
                                onChange={() => togglePermission(module, action)}
                              />
                              <div className="w-5 h-5 border-2 border-border rounded-sm peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center transition-colors">
                                {hasPermission(module, action) && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                              </div>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="px-4 py-2 border border-border text-foreground font-medium rounded-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors"
              >
                Save Role
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium text-muted-foreground">Role Name</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Description</th>
                <th className="px-6 py-3 font-medium text-muted-foreground">Permissions</th>
                <th className="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p>No custom roles found. Create one to get started.</p>
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role._id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{role.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{role.description || "-"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {role.permissions?.length || 0} allowed
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingRole(role)}
                          className="p-2 text-muted-foreground hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(role._id)}
                          className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
