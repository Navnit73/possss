import client from "./mongodb";

export interface ReportSettings {
  enabled: boolean;
  recipients: string[];
  time: string; // "18:00"
  timezone: string; // "America/New_York"
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface StoreSettings {
  tenant_id: string;
  reports?: ReportSettings;
}

export async function getReportSettings(tenantId: string): Promise<ReportSettings | null> {
  const db = client.db("pos");
  const settings = await db.collection("settings").findOne({ tenant_id: tenantId });
  return settings?.reports || null;
}

export async function updateReportSettings(tenantId: string, settings: ReportSettings): Promise<void> {
  const db = client.db("pos");
  await db.collection("settings").updateOne(
    { tenant_id: tenantId },
    { $set: { reports: settings, updated_at: new Date() } },
    { upsert: true }
  );
}

export async function getAllEnabledReportSettings(): Promise<StoreSettings[]> {
  const db = client.db("pos");
  const settingsList = await db.collection("settings").find({ 
    "reports.enabled": true 
  }).toArray();
  
  return settingsList.map(s => ({
    tenant_id: s.tenant_id,
    reports: s.reports
  }));
}
