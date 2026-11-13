import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-muted-foreground/40 text-5xl font-semibold">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Button asChild variant="outline">
        <Link href="/boards">Go to your boards</Link>
      </Button>
    </div>
  );
}
