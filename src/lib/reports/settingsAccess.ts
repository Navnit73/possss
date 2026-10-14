import { Session } from "next-auth";
import { NextResponse } from "next/server";
import { checkPermission, checkRole } from "@/lib/rbac";

/**
 * Report-settings access: SETTINGS:<action> permission, or the MANAGER role (OWNER always passes).
 * Both checks go through the rbac guards, so a store with a lapsed subscription gets the 402 lock.
 */
export function checkReportSettingsAccess(session: Session | null, action: "VIEW" | "EDIT"): NextResponse | null {
  const permError = checkPermission(session, "SETTINGS", action);
  if (!permError) return null;
  if (permError.status === 401 || permError.status === 402) return permError;
  return checkRole(session, ["MANAGER"]) ? permError : null;
}
