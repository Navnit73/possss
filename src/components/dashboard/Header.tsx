import { auth, signOut } from "@/auth";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";

export async function Header() {
  const session = await auth();

  return (
    <header className="bg-surface h-16 border-b border-border px-4 sm:px-6 lg:px-8 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
      {/* Left section space for breadcrumb/title */}
      <div className="flex items-center gap-3"></div>
      
      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-5">
        <CurrencyDropdown variant="light" />

        <div className="h-5 w-px bg-border"></div>

        <div className="text-sm text-right hidden sm:block">
          <p className="font-semibold text-foreground text-xs sm:text-sm leading-tight">{session?.user?.name || "Staff"}</p>
          <p className="text-[11px] text-muted-foreground capitalize leading-none mt-0.5">{(session?.user as any)?.role?.toLowerCase() || "Staff"}</p>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Link 
            href="/account/profile" 
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted cursor-pointer" 
            title="Account Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button 
              type="submit" 
              className="text-muted-foreground hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-muted cursor-pointer" 
              title="Logout"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

