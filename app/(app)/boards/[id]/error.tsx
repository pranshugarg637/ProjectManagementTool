"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Error boundary for the board page (e.g. Supabase unreachable). */
export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <AlertTriangleIcon className="size-8 text-amber-500" />
      <h1 className="text-lg font-semibold">Couldn&apos;t load this board</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        {error.digest
          ? `Error reference: ${error.digest}`
          : "Please check your connection and try again."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/boards">Back to boards</Link>
        </Button>
      </div>
    </div>
  );
}
