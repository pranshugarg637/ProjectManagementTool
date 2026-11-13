import { Skeleton } from "@/components/ui/skeleton";

const CARD_COUNTS = [4, 3, 5, 2];

export default function BoardLoading() {
  return (
    <div
      className="flex h-[calc(100dvh-3.5rem)] flex-col"
      aria-busy="true"
      aria-label="Loading board"
    >
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Skeleton className="size-7" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-16" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <div className="flex gap-3 overflow-hidden px-4 pt-4 sm:px-6">
        {CARD_COUNTS.map((count, i) => (
          <div key={i} className="bg-column w-72 shrink-0 space-y-2 rounded-xl p-2">
            <Skeleton className="mb-3 h-5 w-24" />
            {Array.from({ length: count }).map((_, j) => (
              <Skeleton key={j} className="bg-card h-16 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
