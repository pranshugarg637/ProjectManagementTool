"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Catches errors anywhere below the root layout. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const missingEnv = error.message?.includes("NEXT_PUBLIC_SUPABASE");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertTriangleIcon className="size-8 text-amber-500" />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        {missingEnv
          ? "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README)."
          : "An unexpected error happened. Please try again."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
