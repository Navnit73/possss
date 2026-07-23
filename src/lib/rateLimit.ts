interface RateLimitInfo {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitInfo>();

export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = store.get(ip);

  if (!record) {
    store.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true; // allowed
  }

  if (now > record.resetAt) {
    store.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true; // allowed
  }

  if (record.count >= limit) {
    return false; // rate limited
  }

  record.count++;
  return true; // allowed
}

// Clean up stale entries every 10 minutes to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  store.forEach((record, ip) => {
    if (now > record.resetAt) {
      store.delete(ip);
    }
  });
}, 10 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
