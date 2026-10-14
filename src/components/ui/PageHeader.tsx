import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Accepted for compatibility; icons are not rendered beside page titles (no decorative chrome). */
  icon?: React.ElementType;
  backHref?: string;
  /** Label for the back link; defaults to "Back". */
  backLabel?: string;
  actions?: React.ReactNode;
}

/**
 * Page title block: display-md headline (34px / 600, tight tracking), body-size muted lead,
 * optional "‹ Back" text-link above, actions right-aligned (pill CTAs).
 */
export function PageHeader({ title, description, backHref, backLabel = "Back", actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="text-link inline-flex items-center gap-0.5 text-caption mb-2"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-display-md text-ink leading-tight">{title}</h1>
        {description && <p className="text-body text-ink-48 mt-1">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
