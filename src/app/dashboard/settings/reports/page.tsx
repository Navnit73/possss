"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Save, Send, Loader2, X, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import Swal from "sweetalert2";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];

function safeFormatDate(dateVal: any): string {
  if (!dateVal) return "N/A";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString();
  } catch {
    return "N/A";
  }
}

export default function ReportSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("18:00");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [frequency, setFrequency] = useState("DAILY");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [emailError, setEmailError] = useState("");
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
      console.error("Failed to fetch email history", error);
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
          setTimezone(data.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
          setFrequency(data.settings.frequency || "DAILY");
          setRecipients(data.settings.recipients || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch report settings", error);
    } finally {
      setLoading(false);
    }
  };

  const validateAndAddRecipient = () => {
    const trimmed = newRecipient.trim();
    setEmailError("");

    if (!trimmed) return;

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError("Please enter a valid email address (e.g. name@domain.com)");
      return;
    }

    if (recipients.includes(trimmed)) {
      setEmailError("This email is already in the recipient list");
      return;
    }

    setRecipients([...recipients, trimmed]);
    setNewRecipient("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      validateAndAddRecipient();
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleSave = async () => {
    let finalRecipients = [...recipients];
    const pendingEmail = newRecipient.trim();

    if (pendingEmail) {
      if (EMAIL_REGEX.test(pendingEmail) && !recipients.includes(pendingEmail)) {
        finalRecipients.push(pendingEmail);
        setRecipients(finalRecipients);
        setNewRecipient("");
      } else if (!EMAIL_REGEX.test(pendingEmail)) {
        Swal.fire("Invalid Email", `"${pendingEmail}" is not a valid email address.`, "warning");
        return;
      }
    }

    if (enabled && finalRecipients.length === 0) {
      Swal.fire("Warning", "You must add at least one recipient email address to enable automated daily reports.", "warning");
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

      const data = await res.json();
      if (res.ok) {
        Swal.fire("Success", "Settings saved successfully", "success");
        fetchHistory();
      } else {
        Swal.fire("Error", data.error || "Failed to save settings", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "An unexpected error occurred while saving settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (recipients.length === 0) {
      Swal.fire("Warning", "Please add at least one recipient email address first", "warning");
      return;
    }
    
    const targetEmail = recipients[0];
    setTesting(true);
    try {
      const res = await fetch("/api/settings/reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire("Success", `Test email sent to ${targetEmail}`, "success");
        fetchHistory();
      } else {
        Swal.fire("Error", data.error || "Failed to send test email", "error");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "An error occurred while sending the test email", "error");
    } finally {
      setTesting(false);
    }
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
            <Button 
              variant="outline" 
              onClick={handleTestEmail} 
              disabled={testing || recipients.length === 0}
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" /> : <Send className="w-4 h-4 mr-2" />}
              Test Email
            </Button>

            <Button 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary-foreground" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        }
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden flex flex-col p-6 space-y-8">
        
        {/* Enable Automation Toggle */}
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
        <div className={`space-y-6 ${!enabled ? "opacity-50 pointer-events-none" : ""}`}>
          
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
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
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

          {/* Email Recipients */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-foreground">Recipients</label>
            
            <div className="flex gap-2 w-full">
              <Input 
                type="email" 
                placeholder="email@example.com" 
                value={newRecipient} 
                onChange={(e) => {
                  setNewRecipient(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onKeyDown={handleKeyDown}
                className="w-full"
              />
              <Button type="button" variant="secondary" onClick={validateAndAddRecipient}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {emailError && (
              <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {emailError}
              </p>
            )}

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {recipients.map((email) => (
                  <div 
                    key={email} 
                    className="flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                  >
                    <span>{email}</span>
                    <button 
                      type="button" 
                      onClick={() => removeRecipient(email)} 
                      className="text-muted-foreground hover:text-foreground"
                    >
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
                      {safeFormatDate(log.sentAt)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{log.date || "N/A"}</td>
                    <td className="p-4 text-sm text-muted-foreground max-w-[200px] truncate" title={log.recipients?.join(", ")}>
                      {log.recipients?.join(", ") || "N/A"}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {log.status}
                      </span>
                      {log.error && (
                        <p className="text-xs text-rose-500 mt-1 max-w-[200px] truncate" title={log.error}>
                          {log.error}
                        </p>
                      )}
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
