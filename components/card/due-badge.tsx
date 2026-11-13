import { CalendarIcon } from "lucide-react";
import { formatDueDate, getDueStatus } from "@/lib/due-date";
import { cn } from "@/lib/utils";

const STYLES = {
  overdue: "bg-red-500/15 text-red-700 dark:text-red-300",
  today: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  soon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  later: "bg-muted text-muted-foreground",
} as const;

export function DueBadge({ due, today }: { due: string | null; today: string }) {
  const status = getDueStatus(due, today);
  if (!due || !status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        STYLES[status],
      )}
      title={status === "overdue" ? "Overdue" : `Due ${due}`}
    >
      <CalendarIcon className="size-3" aria-hidden />
      {status === "today" ? "Today" : formatDueDate(due, today)}
      {status === "overdue" && <span className="sr-only">(overdue)</span>}
    </span>
  );
}
