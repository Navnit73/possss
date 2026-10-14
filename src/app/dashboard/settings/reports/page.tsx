"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { Save, Send, X, Plus, AlertCircle } from "lucide-react";
import Swal from "@/lib/swal";

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.settings) {
        setEnabled(data.settings.enabled ?? false);
        setTime(data.settings.time || "18:00");
        setTimezone(data.settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
        setFrequency(data.settings.frequency || "DAILY");
        setRecipients(data.settings.recipients || []);
      }
    } catch (error) {
      console.error("Failed to fetch report settings", error);
      Swal.fire("Error", "Couldn't load your saved report settings. Reload before saving so they aren't overwritten.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, []);

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
    const finalRecipients = [...recipients];
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
        <Spinner />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader 
        title="Report Settings"
        description="Configure automated email reports for your store"
        actions={
          <>
            <Button 
              variant="outline" 
              onClick={handleTestEmail} 
              disabled={recipients.length === 0}
              loading={testing}
            >
              {!testing && <Send aria-hidden="true" />}
              Test Email
            </Button>

            <Button 
              onClick={handleSave} 
              loading={saving}
            >
              {!saving && <Save aria-hidden="true" />}
              Save Settings
            </Button>
          </>
        }
      />

      <Card>
        {/* Enable Automation Toggle */}
        <CardHeader className="flex-row items-center justify-between gap-6 border-b border-hairline">
          <div className="space-y-1">
            <CardTitle id="automated-reports-title">Automated Reports</CardTitle>
            <CardDescription>Receive daily summaries of your store&apos;s performance.</CardDescription>
          </div>

          <label className="press relative inline-flex items-center cursor-pointer shrink-0">
            <input 
              type="checkbox" 
              role="switch"
              aria-labelledby="automated-reports-title"
              className="sr-only peer" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
            />
            <span
              aria-hidden="true"
              className="block w-12 h-7 rounded-full bg-chip peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-focus transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-canvas after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
        </CardHeader>

        {/* Configurations */}
        <CardContent className={`pt-6 space-y-6 ${!enabled ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="report-time">Schedule Time</Label>
              <Input 
                id="report-time"
                type="time" 
                value={time} 
                onChange={(e) => setTime(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="report-timezone">Timezone</Label>
              <Select 
                id="report-timezone"
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full"
              >
                {/* Keep the saved / browser timezone selectable even when it isn't in the preset list */}
                {(TIMEZONE_OPTIONS.some((tz) => tz.value === timezone)
                  ? TIMEZONE_OPTIONS
                  : [{ value: timezone, label: timezone }, ...TIMEZONE_OPTIONS]
                ).map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-frequency">Frequency</Label>
            <Select 
              id="report-frequency"
              value={frequency} 
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full"
            >
              <option value="DAILY">Daily (End of Day)</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </Select>
            <p className="text-caption text-ink-48">Currently, only Daily reports are fully supported by the job scheduler.</p>
          </div>

          {/* Email Recipients */}
          <div className="space-y-3">
            <Label htmlFor="report-recipient">Recipients</Label>
            
            <div className="flex gap-2 w-full">
              <Input 
                id="report-recipient"
                type="email" 
                placeholder="email@example.com" 
                value={newRecipient} 
                aria-invalid={emailError ? true : undefined}
                onChange={(e) => {
                  setNewRecipient(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onKeyDown={handleKeyDown}
                className="w-full"
              />
              <Button type="button" variant="outline" size="icon" onClick={validateAndAddRecipient} aria-label="Add recipient">
                <Plus aria-hidden="true" />
              </Button>
            </div>

            {emailError && (
              <p className="text-caption text-destructive flex items-center gap-1.5">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {emailError}
              </p>
            )}

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {recipients.map((email) => (
                  <span 
                    key={email} 
                    className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas pl-4 pr-1 min-h-9 text-caption text-ink"
                  >
                    <span>{email}</span>
                    <button 
                      type="button" 
                      onClick={() => removeRecipient(email)} 
                      aria-label={`Remove ${email}`}
                      className="press cursor-pointer size-7 rounded-full flex items-center justify-center text-ink-48"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {recipients.length === 0 && (
              <Alert variant="warning">
                <p>You must add at least one recipient to receive automated reports.</p>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email History Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Email Dispatch History</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent At</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-ink-48">
                  No reports have been sent yet.
                </TableCell>
              </TableRow>
            ) : (
              history.map((log, i) => (
                <TableRow key={i}>
                  <TableCell className="text-ink tabular">
                    {safeFormatDate(log.sentAt)}
                  </TableCell>
                  <TableCell className="text-ink-48 tabular">{log.date || "N/A"}</TableCell>
                  <TableCell className="text-ink-48 max-w-52 truncate" title={log.recipients?.join(", ")}>
                    {log.recipients?.join(", ") || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "SUCCESS" ? "success" : "destructive"}>
                      {log.status}
                    </Badge>
                    {log.error && (
                      <p className="text-fine-print text-destructive mt-1 max-w-52 truncate" title={log.error}>
                        {log.error}
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </PageShell>
  );
}
