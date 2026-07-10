import { auth, signOut } from "@/auth";
import { LogOut } from "lucide-react";

export async function Header() {
  const session = await auth();

  return (
    <header className="bg-surface h-16 border-b border-border px-8 flex justify-between items-center sticky top-0 z-10">
      {/* Title space if needed, otherwise empty to push profile to the right */}
      <div></div>
      
      <div className="flex items-center gap-6">
        <div className="text-sm text-right">
          <p className="font-medium text-foreground">{session?.user?.name}</p>
          <p className="text-muted-foreground capitalize">{(session?.user as any)?.role?.toLowerCase()}</p>
        </div>
        
        <form action={async () => {
          "use server";
          await signOut();
        }}>
          <button type="submit" className="text-muted-foreground hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
