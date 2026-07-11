"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Users, Search, Trash, Shield } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role_id: "" });
  const [addError, setAddError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get("/api/users"),
        axios.get("/api/roles")
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      if (rolesRes.data.length > 0) {
        setNewUser(prev => ({ ...prev, role_id: rolesRes.data[0]._id }));
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAddError("");
    try {
      await axios.post("/api/users", { ...newUser, role: "CUSTOM" });
      setIsAddingUser(false);
      setNewUser({ name: "", email: "", password: "", role_id: roles.length > 0 ? roles[0]._id : "" });
      fetchData();
    } catch (err: any) {
      setAddError(err.response?.data?.error || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleName = (user: any) => {
    if (user.role === "OWNER") return "Owner";
    if (user.role_id) {
      const role = roles.find(r => r._id === user.role_id);
      if (role) return role.name;
    }
    return user.role;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Staff & Users"
        description="Manage access and roles for your pharmacy staff."
        actions={
          <button
            onClick={() => setIsAddingUser(!isAddingUser)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {isAddingUser ? "Cancel" : "Add User"}
          </button>
        }
      />

      {isAddingUser && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Add New User</h3>
          {addError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {addError}
            </div>
          )}
          {roles.length === 0 ? (
            <div className="mb-4 p-4 border border-border bg-muted/50 rounded-md text-sm flex gap-3 items-center">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">No custom roles found.</p>
                <p className="text-muted-foreground">You need to create a role in Permissions before you can add staff.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Name</label>
                <input 
                  required
                  type="text" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email</label>
                <input 
                  required
                  type="email" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Password</label>
                <input 
                  required
                  type="password" 
                  minLength={8}
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Role</label>
                <select 
                  required
                  value={newUser.role_id}
                  onChange={e => setNewUser({...newUser, role_id: e.target.value})}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                >
                  {roles.map(r => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col ">
        <div className="p-4 border-b border-border bg-secondary/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search users by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <TableSkeleton columns={4} rows={4} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No users found</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              {search ? "Try adjusting your search terms." : "You haven't added any staff members yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="p-4 text-sm font-semibold text-foreground">Name</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Email</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Role</th>
                  <th className="p-4 text-sm font-semibold text-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr key={u._id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-medium text-foreground">{u.name}</td>
                    <td className="p-4 text-sm text-foreground">{u.email}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-primary/10 text-primary border-primary/20`}>
                        {getRoleName(u)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
