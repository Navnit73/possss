import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ElementType;
  backHref?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, backHref, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link 
            href={backHref} 
            className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
        )}
        {Icon && !backHref && (
          <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
            <Icon className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
