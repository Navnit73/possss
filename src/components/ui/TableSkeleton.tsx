import { Spinner } from "./Spinner"

export function TableSkeleton({ columns = 5, rows = 5 }: { columns?: number; rows?: number }) {
  return (
    <div className="w-full flex items-center justify-center p-12" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Spinner className="w-10 h-10" label="" />
        <span className="text-sm font-medium animate-pulse">Loading data...</span>
      </div>
    </div>
  )
}
