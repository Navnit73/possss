import { Db, ObjectId } from "mongodb";
import { formatInTimeZone } from "date-fns-tz";

export function resolveTimezone(tz: unknown): string {
  if (typeof tz !== "string" || !tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Today's calendar date ("yyyy-MM-dd") in the store's own timezone — what "expired" is judged against. */
export async function getStoreToday(db: Db, tenantId: string): Promise<string> {
  const tenant = ObjectId.isValid(tenantId)
    ? await db.collection("tenants").findOne({ _id: new ObjectId(tenantId) }, { projection: { timezone: 1 } })
    : null;
  return formatInTimeZone(new Date(), resolveTimezone(tenant?.timezone), "yyyy-MM-dd");
}

/** A batch with no expiry date never expires. */
export function isExpired(expiryDate: unknown, today: string): boolean {
  return typeof expiryDate === "string" && expiryDate.trim() !== "" && expiryDate < today;
}
