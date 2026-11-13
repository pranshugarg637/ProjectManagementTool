import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/boards" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg shadow-sm">
        {/* three little columns = a kanban board */}
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
          <rect x="2" y="2" width="3" height="12" rx="1" />
          <rect x="6.5" y="2" width="3" height="8" rx="1" />
          <rect x="11" y="2" width="3" height="10" rx="1" />
        </svg>
      </span>
      <span>Flowboard</span>
    </Link>
  );
}
