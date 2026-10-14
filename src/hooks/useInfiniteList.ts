"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

export type PageResponse<T> = { items: T[]; total: number; hasMore: boolean; [extra: string]: unknown };

const apiError = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && (err.response?.data as { error?: string } | undefined)?.error) || fallback;

/**
 * Server-side paginated list with scroll-to-load.
 * The endpoint must accept ?limit=&offset= (plus any extra `params`) and return { items, total, hasMore }.
 * Attach `sentinelRef` to an element below the list; the next page loads when it scrolls into view.
 */
export function useInfiniteList<T extends { _id: string }>(
  url: string,
  { pageSize = 100, params = {}, errorMessage = "Failed to load data" }: { pageSize?: number; params?: Record<string, string | undefined>; errorMessage?: string } = {}
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Latest page response, for endpoint-specific extras (e.g. a summary block)
  const [response, setResponse] = useState<PageResponse<T> | null>(null);
  // The query whose first page is currently shown — loading until it matches the current query
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Bumped whenever the query changes so responses for an older query are ignored
  const requestGen = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Stable key for the extra params so callers can pass an inline object
  const paramsKey = JSON.stringify(params);
  const queryKey = `${url}|${pageSize}|${paramsKey}`;
  const isLoading = loadedKey !== queryKey;

  const fetchPage = useCallback(
    async (offset: number) => {
      const res = await axios.get<PageResponse<T>>(url, { params: { ...JSON.parse(paramsKey), limit: pageSize, offset } });
      return res.data;
    },
    [url, pageSize, paramsKey]
  );

  // First page whenever the query changes
  useEffect(() => {
    const gen = ++requestGen.current;
    // A "load more" for the previous query may still be in flight; its result is dropped by the gen check
    loadingMoreRef.current = false;
    const settle = () => {
      setIsLoadingMore(false);
      setLoadedKey(queryKey);
    };
    fetchPage(0)
      .then((data) => {
        if (gen !== requestGen.current) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setHasMore(!!data.hasMore);
        setResponse(data);
        setError("");
        settle();
      })
      .catch((err: unknown) => {
        if (gen !== requestGen.current) return;
        console.error(errorMessage, err);
        setError(apiError(err, errorMessage));
        setItems([]);
        setTotal(0);
        setHasMore(false);
        setResponse(null);
        settle();
      });
  }, [fetchPage, errorMessage, queryKey]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || isLoading) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const gen = requestGen.current;
    try {
      const data = await fetchPage(items.length);
      if (gen !== requestGen.current) return;
      setItems((prev) => {
        // Skip rows already shown (the list may have shifted between pages)
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...(data.items || []).filter((p) => !seen.has(p._id))];
      });
      setTotal(data.total || 0);
      setHasMore(!!data.hasMore);
      setResponse(data);
    } catch (err: unknown) {
      if (gen !== requestGen.current) return;
      setError(apiError(err, errorMessage));
      setHasMore(false);
    } finally {
      if (gen === requestGen.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoading, items.length, fetchPage, errorMessage]);

  // Load the next page when the bottom of the list scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return { items, total, hasMore, isLoading, isLoadingMore, error, loadMore, sentinelRef, response };
}
