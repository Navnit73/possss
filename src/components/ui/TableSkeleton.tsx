import { Spinner } from "./Spinner"

export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="w-full flex items-center justify-center p-12" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-48">
        <Spinner label="" />
        <span className="text-caption">Loading…</span>
      </div>
    </div>
  )
}
