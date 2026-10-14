import { auth, signOut } from "@/auth";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";

/** Pass `session` from the layout (which already called auth()) to avoid decoding it twice per request. */
export async function Header({ session: sessionProp }: { session?: Session | null } = {}) {
  const session = sessionProp === undefined ? await auth() : sessionProp;

  return (
    <header className="bg-surface h-16 border-b border-border px-4 sm:px-6 lg:px-8 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
      {/* Left section space for breadcrumb/title */}
      <div className="flex items-center gap-3"></div>
      
      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-5">
        <CurrencyDropdown variant="light" />

        <div className="h-5 w-px bg-border" aria-hidden="true"></div>

        <div className="text-sm text-right hidden sm:block">
          <p className="font-semibold text-foreground text-xs sm:text-sm leading-tight">{session?.user?.name || "Staff"}</p>
          <p className="text-[11px] text-muted-foreground capitalize leading-none mt-0.5">{(session?.user as any)?.role?.toLowerCase() || "Staff"}</p>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Link 
            href="/account/profile" 
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
            title="Account Settings"
            aria-label="Account Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </Link>
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button 
              type="submit" 
              className="text-muted-foreground hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
              title="Logout"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

