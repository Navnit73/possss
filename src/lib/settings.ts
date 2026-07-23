import client from "./mongodb";
import { ObjectId } from "mongodb";

export interface ReportSettings {
  enabled: boolean;
  recipients: string[];
  time: string; // e.g. "18:00"
  timezone: string; // e.g. "America/New_York"
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface StoreSettings {
  tenant_id: string;
  reports?: ReportSettings;
}

function getTenantIdQueries(tenantId: string) {
  if (!tenantId) return [tenantId];
  if (ObjectId.isValid(tenantId)) {
    return [tenantId, new ObjectId(tenantId)];
  }
  return [tenantId];
}

export async function getReportSettings(tenantId: string): Promise<ReportSettings | null> {
  if (!tenantId) return null;
  const db = client.db("pos");
  const tenantIds = getTenantIdQueries(tenantId);
  const settings = await db.collection("settings").findOne({ tenant_id: { $in: tenantIds } });
  return settings?.reports || null;
}

export async function updateReportSettings(tenantId: string, settings: ReportSettings): Promise<void> {
  if (!tenantId) return;
  const db = client.db("pos");
  const tenantIds = getTenantIdQueries(tenantId);
  
  await db.collection("settings").updateOne(
    { tenant_id: { $in: tenantIds } },
    { $set: { tenant_id: tenantId, reports: settings, updated_at: new Date() } },
    { upsert: true }
  );
}

export async function getAllEnabledReportSettings(): Promise<StoreSettings[]> {
  const db = client.db("pos");
  const settingsList = await db.collection("settings").find({ 
    "reports.enabled": true 
  }).toArray();
  
  return settingsList.map(s => ({
    tenant_id: String(s.tenant_id),
    reports: s.reports
  }));
}
