import { after } from "next/server";

/**
 * Executes a background task after the response is sent if supported by the runtime,
 * falling back gracefully to microtask execution when running outside Next.js request scope.
 */
export function runAfterResponse(task: () => Promise<void> | void): void {
  try {
    after(task);
  } catch {
    // Fallback when called outside Next.js request context (e.g., tests, CLI scripts)
    Promise.resolve().then(async () => {
      try {
        await task();
      } catch (err) {
        console.error("[runAfterResponse error]", err);
      }
    });
  }
}
