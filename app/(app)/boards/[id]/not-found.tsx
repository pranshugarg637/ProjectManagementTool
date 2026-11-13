import Link from "next/link";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BoardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="bg-muted grid size-12 place-items-center rounded-full">
        <LockIcon className="text-muted-foreground size-5" />
      </div>
      <h1 className="text-lg font-semibold">Board not found</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        It may have been deleted, or you don&apos;t have access. Ask an owner to invite you.
      </p>
      <Button asChild variant="outline">
        <Link href="/boards">Back to your boards</Link>
      </Button>
    </div>
  );
}
