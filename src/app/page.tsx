import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-success/5 rounded-full blur-3xl -z-10" />

      {/* Navbar */}
      <nav className="w-full px-8 py-6 flex justify-between items-center border-b border-border/50 bg-surface/50 backdrop-blur-md z-10 relative">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="w-8 h-8" />
          <span className="font-display font-bold text-xl tracking-tight">Pharmacy POS</span>
        </div>
        <div className="flex gap-4">
          <Link href="/auth/login" className="px-4 py-2 font-medium text-foreground hover:text-primary transition-colors">
            Log in
          </Link>
          <Link href="/auth/register" className="px-4 py-2 font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-md transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center text-center px-4 py-24 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Next Generation Pharmacy OS
        </div>

        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6 leading-tight">
          Clinical precision meets <br className="hidden md:block"/> 
          <span className="text-primary">retail efficiency.</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
          The all-in-one point of sale and inventory management system designed specifically for modern pharmacies.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/auth/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 font-medium text-lg text-primary-foreground bg-primary hover:bg-primary-hover rounded-md transition-colors">
            Start your free trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/auth/login" className="inline-flex items-center justify-center px-8 py-4 font-medium text-lg text-foreground bg-white border border-border hover:border-primary hover:text-primary rounded-md transition-colors">
            Sign in to terminal
          </Link>
        </div>
      </main>
    </div>
  );
}
