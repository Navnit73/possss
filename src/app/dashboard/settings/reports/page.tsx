"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Settings2, Save, Send, Loader2, X, Plus } from "lucide-react";
import Swal from "sweetalert2";

export default function ReportSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [frequency, setFrequency] = useState("DAILY");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/settings/reports/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings/reports");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setEnabled(data.settings.enabled ?? false);
          setTime(data.settings.time || "18:00");
          setTimezone(data.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
          setFrequency(data.settings.frequency || "DAILY");
          setRecipients(data.settings.recipients || []);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    let finalRecipients = [...recipients];
    if (newRecipient && !recipients.includes(newRecipient)) {
      finalRecipients.push(newRecipient);
      setRecipients(finalRecipients);
      setNewRecipient("");
    }

    if (enabled && finalRecipients.length === 0) {
      Swal.fire('Warning', 'You must add at least one recipient to enable automated reports.', 'warning');
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch("/api/settings/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          time,
          timezone,
          frequency,
          recipients: finalRecipients
        })
      });
      if (res.ok) {
        Swal.fire('Success', "Settings saved successfully", 'success');
      } else {
        const data = await res.json();
        Swal.fire('Error', data.error || "Failed to save settings", 'error');
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Error', "An error occurred", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (recipients.length === 0) {
      Swal.fire('Warning', "Please add at least one recipient first", 'warning');
      return;
    }
    
    setTesting(true);
    try {
      const res = await fetch("/api/settings/reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recipients[0] }) // Test with first recipient
      });
      if (res.ok) {
        Swal.fire('Success', `Test email sent to ${recipients[0]}`, 'success');
      } else {
        const data = await res.json();
        Swal.fire('Error', data.error || "Failed to send test email", 'error');
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Error', "An error occurred during testing", 'error');
    } finally {
      setTesting(false);
    }
  };

  const addRecipient = () => {
    if (newRecipient && !recipients.includes(newRecipient)) {
      setRecipients([...recipients, newRecipient]);
      setNewRecipient("");
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Report Settings"
        description="Configure automated email reports for your store"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTestEmail} disabled={testing || recipients.length === 0}>
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Test Email
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        }
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col p-6 space-y-8">
        
        {/* Enable Toggle */}
        <div className="flex items-center justify-between pb-6 border-b border-border">
          <div>
            <h3 className="text-lg font-medium text-foreground">Automated Reports</h3>
            <p className="text-sm text-muted-foreground">Receive daily summaries of your store's performance.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
            />
            <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Configurations */}
        <div className={`space-y-6 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Schedule Time</label>
              <Input 
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Timezone</label>
              <Select 
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full"
              >
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="Europe/London">London</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="UTC">UTC</option>
                {/* Additional timezones can be populated */}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Frequency</label>
            <Select 
              value={frequency} 
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full"
            >
              <option value="DAILY">Daily (End of Day)</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Currently, only Daily reports are fully supported by the job scheduler.</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground">Recipients</label>
            <div className="flex gap-2 w-full">
              <Input 
                type="email" 
                placeholder="email@example.com" 
                value={newRecipient} 
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
              />
              <Button type="button" variant="secondary" onClick={addRecipient}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {recipients.map(email => (
                  <div key={email} className="flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm">
                    <span>{email}</span>
                    <button type="button" onClick={() => removeRecipient(email)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {recipients.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                You must add at least one recipient to receive automated reports.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Email History Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border bg-secondary/30">
          <h3 className="font-medium text-foreground">Email Dispatch History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="p-4 text-sm font-semibold text-foreground">Sent At</th>
                <th className="p-4 text-sm font-semibold text-foreground">Report Date</th>
                <th className="p-4 text-sm font-semibold text-foreground">Recipients</th>
                <th className="p-4 text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">
                    No reports have been sent yet.
                  </td>
                </tr>
              ) : (
                history.map((log, i) => (
                  <tr key={i} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 text-sm text-foreground">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{log.date}</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate" title={log.recipients?.join(", ")}>
                      {log.recipients?.join(", ")}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status}
                      </span>
                      {log.error && <p className="text-xs text-rose-500 mt-1 max-w-[200px] truncate" title={log.error}>{log.error}</p>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
