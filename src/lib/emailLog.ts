import client from "./mongodb";
import { ObjectId } from "mongodb";

export type EmailLogStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface EmailLogEntry {
  tenant_id: string;
  reportType: string;
  date: string; // ISO date string without time (e.g., "2026-07-23")
  status: EmailLogStatus;
  sentAt: Date;
  recipients: string[];
  error?: string;
}

/** A PENDING attempt older than this is treated as crashed and no longer blocks a retry. */
const PENDING_STALE_MS = 30 * 60 * 1000;

function getTenantIdQueries(tenantId: string) {
  if (!tenantId) return [tenantId];
  if (ObjectId.isValid(tenantId)) {
    return [tenantId, new ObjectId(tenantId)];
  }
  return [tenantId];
}

function truncateError(error: unknown): string {
  return String(error ?? "Unknown error").slice(0, 500);
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
  }, { projection: { _id: 1 } });
  return !!log;
}

/** What has already happened for this report/day: sent, still in flight, and how many attempts failed. */
export async function getReportAttemptSummary(tenantId: string, reportType: string, dateStr: string) {
  const db = client.db("pos");
  const logs = await db.collection("email_logs")
    .find(
      { tenant_id: { $in: getTenantIdQueries(tenantId) }, reportType, date: dateStr },
      { projection: { status: 1, sentAt: 1 } }
    )
    .limit(50)
    .toArray();
  const now = Date.now();
  return {
    sent: logs.some((l) => l.status === "SUCCESS"),
    inFlight: logs.some((l) => l.status === "PENDING" && now - new Date(l.sentAt).getTime() < PENDING_STALE_MS),
    failures: logs.filter((l) => l.status === "FAILED").length,
  };
}

export async function logEmailAttempt(entry: EmailLogEntry): Promise<void> {
  const db = client.db("pos");
  await db.collection("email_logs").insertOne({ ...entry, ...(entry.error ? { error: truncateError(entry.error) } : {}) });
}

/** Records an attempt as PENDING before sending, so a failure to log afterwards can't cause a duplicate send. */
export async function startEmailAttempt(entry: Omit<EmailLogEntry, "status" | "sentAt" | "error">): Promise<ObjectId> {
  const db = client.db("pos");
  const res = await db.collection("email_logs").insertOne({ ...entry, status: "PENDING", sentAt: new Date() });
  return res.insertedId;
}

export async function finishEmailAttempt(id: ObjectId, status: "SUCCESS" | "FAILED", error?: unknown): Promise<void> {
  const db = client.db("pos");
  await db.collection("email_logs").updateOne(
    { _id: id },
    { $set: { status, sentAt: new Date(), ...(status === "FAILED" ? { error: truncateError(error) } : {}) } }
  );
}

export async function getEmailHistory(tenantId: string, limit = 50): Promise<EmailLogEntry[]> {
  if (!tenantId) return [];
  const db = client.db("pos");
  const tenantIds = getTenantIdQueries(tenantId);

  return await db.collection("email_logs")
    .find({ tenant_id: { $in: tenantIds } }, { projection: { _id: 0, tenant_id: 0 } })
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray() as unknown as EmailLogEntry[];
}
