"use client";

import { useState, useEffect } from "react";
import { ActivitySquare } from "lucide-react";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/account/activity");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8"><TableSkeleton columns={3} rows={8} /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground">Monitor system events and user actions within your pharmacy.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-sm">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium text-muted-foreground w-48">Timestamp</th>
              <th className="px-6 py-3 font-medium text-muted-foreground w-48">Action</th>
              <th className="px-6 py-3 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                  <ActivitySquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>No activity logs found.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <pre className="text-xs bg-background p-2 rounded border border-border overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
