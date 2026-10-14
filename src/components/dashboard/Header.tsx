import { auth, signOut } from "@/auth";
import { Activity, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";

/**
 * global-nav: 44px true-black bar, nav-link type (12px / 400 / -0.12px), white text.
 * Pass `session` from the layout (which already called auth()) to avoid decoding it twice per request.
 * `withMobileMenu` reserves the left slot for the Sidebar's drawer trigger below `lg`.
 */
export async function Header({
  session: sessionProp,
  withMobileMenu = false,
}: { session?: Session | null; withMobileMenu?: boolean } = {}) {
  const session = sessionProp === undefined ? await auth() : sessionProp;

  return (
    <header className="sticky top-0 z-40 h-11 bg-black text-on-dark print:hidden">
      <div className={`h-full flex items-center justify-between gap-4 px-4 sm:px-6 ${withMobileMenu ? "pl-14 lg:pl-6" : ""}`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-nav-link font-semibold text-on-dark">
          <Activity className="size-4" aria-hidden="true" />
          <span>Pharmacy POS</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <CurrencyDropdown variant="dark" />

          <span className="hidden sm:block text-nav-link text-body-muted">
            <span className="text-on-dark">{session?.user?.name || "Staff"}</span>
            <span className="capitalize"> · {(session?.user as any)?.role?.toLowerCase() || "staff"}</span>
          </span>

          <Link
            href="/account/profile"
            className="press flex size-8 items-center justify-center rounded-full text-on-dark/80"
            title="Account Settings"
            aria-label="Account Settings"
          >
            <Settings className="size-4" aria-hidden="true" />
          </Link>
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button
              type="submit"
              className="press flex size-8 items-center justify-center rounded-full text-on-dark/80 cursor-pointer"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
