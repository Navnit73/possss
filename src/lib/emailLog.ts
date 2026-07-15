import client from "./mongodb";

export interface EmailLogEntry {
  tenant_id: string;
  reportType: string;
  date: string; // ISO date string without time (e.g., "2023-10-15")
  status: "SUCCESS" | "FAILED";
  sentAt: Date;
  recipients: string[];
  error?: string;
}

export async function hasReportBeenSentToday(tenantId: string, reportType: string, dateStr: string): Promise<boolean> {
  const db = client.db("pos");
  const log = await db.collection("email_logs").findOne({
    tenant_id: tenantId,
    reportType,
    date: dateStr,
    status: "SUCCESS"
  });
  return !!log;
}

export async function logEmailAttempt(entry: EmailLogEntry): Promise<void> {
  const db = client.db("pos");
  await db.collection("email_logs").insertOne(entry);
}

export async function getEmailHistory(tenantId: string, limit = 50): Promise<EmailLogEntry[]> {
  const db = client.db("pos");
  return await db.collection("email_logs")
    .find({ tenant_id: tenantId })
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray() as unknown as EmailLogEntry[];
}
