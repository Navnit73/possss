import { auth, signOut } from "@/auth";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { CurrencyDropdown } from "@/components/ui/CurrencyDropdown";

export async function Header() {
  const session = await auth();

  return (
    <header className="bg-surface h-16 border-b border-border px-8 flex justify-between items-center sticky top-0 z-10">
      {/* Title space if needed, otherwise empty to push profile to the right */}
      <div></div>
      
      <div className="flex items-center gap-5">
        <CurrencyDropdown variant="light" />

        <div className="h-5 w-px bg-border"></div>

        <div className="text-sm text-right">
          <p className="font-medium text-foreground">{session?.user?.name}</p>
          <p className="text-muted-foreground capitalize">{(session?.user as any)?.role?.toLowerCase()}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/account/profile" className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted" title="Account Settings">
            <Settings className="w-5 h-5" />
          </Link>
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button type="submit" className="text-muted-foreground hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-muted cursor-pointer" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

