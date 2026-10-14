import type { Ref } from "react";
import { Loader2 } from "lucide-react";

/** Footer for a scroll-paginated list: doubles as the scroll sentinel, with a manual "Load more" fallback. */
export function InfiniteListFooter({
  sentinelRef,
  isLoadingMore,
  hasMore,
  loaded,
  total,
  noun,
  onLoadMore,
}: {
  sentinelRef: Ref<HTMLDivElement>;
  isLoadingMore: boolean;
  hasMore: boolean;
  loaded: number;
  total: number;
  noun: string;
  onLoadMore: () => void;
}) {
  return (
    <div ref={sentinelRef} className="flex items-center justify-center gap-2 px-4 py-4 border-t border-hairline text-caption text-ink-48" role="status">
      {isLoadingMore ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading more {noun}...
        </>
      ) : hasMore ? (
        <button type="button" onClick={onLoadMore} className="text-primary font-semibold tabular">
          Load more ({loaded.toLocaleString()} of {total.toLocaleString()})
        </button>
      ) : (
        <span className="tabular">Showing all {total.toLocaleString()} {noun}</span>
      )}
    </div>
  );
}
