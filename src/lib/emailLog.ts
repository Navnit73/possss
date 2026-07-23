import client from "./mongodb";
import { ObjectId } from "mongodb";

export interface EmailLogEntry {
  tenant_id: string;
  reportType: string;
  date: string; // ISO date string without time (e.g., "2026-07-23")
  status: "SUCCESS" | "FAILED";
  sentAt: Date;
  recipients: string[];
  error?: string;
}

function getTenantIdQueries(tenantId: string) {
  if (!tenantId) return [tenantId];
  if (ObjectId.isValid(tenantId)) {
    return [tenantId, new ObjectId(tenantId)];
  }
  return [tenantId];
}

export async function hasReportBeenSentToday(tenantId: string, reportType: string, dateStr: string): Promise<boolean> {
  if (!tenantId) return false;
  const db = client.db("pos");
  const tenantIds = getTenantIdQueries(tenantId);
  const log = await db.collection("email_logs").findOne({
    tenant_id: { $in: tenantIds },
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
  if (!tenantId) return [];
  const db = client.db("pos");
  const tenantIds = getTenantIdQueries(tenantId);

  return await db.collection("email_logs")
    .find({ tenant_id: { $in: tenantIds } })
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray() as unknown as EmailLogEntry[];
}
