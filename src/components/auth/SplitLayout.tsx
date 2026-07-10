import React from "react";
import { Activity } from "lucide-react";

export function SplitLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Form Side */}
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 bg-surface py-12">
        <div className="w-full max-w-md mx-auto space-y-8">
          <div className="flex items-center gap-2 text-primary mb-12">
            <Activity className="w-8 h-8" />
            <span className="font-display font-bold text-xl tracking-tight">Pharmacy POS</span>
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>

      {/* Hero Side */}
      <div className="hidden md:flex relative bg-primary flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#005575] to-success opacity-90" />
        {/* Abstract Geometry */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-success/20 rounded-full blur-2xl" />
        
        <div className="relative z-10 p-12 max-w-lg text-center">
          <h2 className="font-display text-4xl font-bold text-primary-foreground leading-tight mb-6">
            Precision in every prescription.
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            Streamline your pharmacy operations with our clinical-grade inventory management and point of sale system.
          </p>
        </div>
      </div>
    </div>
  );
}
