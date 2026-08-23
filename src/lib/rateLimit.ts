import client from "./mongodb";

interface RateLimitRecord {
  _id: string;
  count: number;
  resetAt: Date;
}

/**
 * A fixed-window limiter backed by MongoDB so all server instances enforce the
 * same limit. The counter is allowed to increment after the limit is reached;
 * this preserves the window without a read-then-write race.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const nowDate = new Date(now);
  const resetAt = new Date(now + windowMs);
  const expired = { $lte: [{ $ifNull: ["$resetAt", new Date(0)] }, nowDate] };

  const result = await client.db("pos").collection<RateLimitRecord>("rate_limits").findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [expired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
          resetAt: { $cond: [expired, resetAt, "$resetAt"] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" }
  );

  return (result?.count ?? limit + 1) <= limit;
}

/** Only use this after a trusted proxy has normalized the forwarding header. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
