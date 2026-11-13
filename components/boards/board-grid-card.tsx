import Link from "next/link";
import { LayoutListIcon, SquareStackIcon } from "lucide-react";
import { RoleBadge } from "@/components/board/role-badge";
import { hashString } from "@/lib/utils";
import type { BoardSummary } from "@/types/app";

const STRIPES = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
];

export function BoardGridCard({ board }: { board: BoardSummary }) {
  const stripe = STRIPES[hashString(board.id) % STRIPES.length];
  return (
    <Link
      href={`/boards/${board.id}`}
      className="group bg-card focus-visible:ring-ring/50 relative flex flex-col overflow-hidden rounded-xl border shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className={`h-1.5 bg-gradient-to-r ${stripe}`} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="group-hover:text-primary line-clamp-2 font-semibold tracking-tight">
            {board.title}
          </h2>
          <RoleBadge role={board.role} />
        </div>
        {board.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{board.description}</p>
        ) : (
          <p className="text-muted-foreground/60 text-sm italic">No description</p>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-4 pt-1 text-xs">
          <span className="flex items-center gap-1">
            <LayoutListIcon className="size-3.5" /> {board.listCount} lists
          </span>
          <span className="flex items-center gap-1">
            <SquareStackIcon className="size-3.5" /> {board.cardCount} cards
          </span>
        </div>
      </div>
    </Link>
  );
}
