"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeftIcon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import { DueBadge } from "@/components/card/due-badge";
import { LabelChip } from "@/components/card/label-chip";
import { cn } from "@/lib/utils";
import type { Card } from "@/types/app";

/** The visual card (used in the list AND in the drag overlay). */
export function CardView({
  card,
  today,
  className,
  overlay = false,
}: {
  card: Card;
  today: string;
  className?: string;
  overlay?: boolean;
}) {
  const hasMeta = card.due_date || card.description;
  return (
    <div
      className={cn(
        "bg-card rounded-lg border px-3 py-2.5 text-sm shadow-xs transition-shadow",
        overlay && "ring-primary/40 rotate-2 cursor-grabbing shadow-xl ring-2",
        className,
      )}
    >
      {card.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <LabelChip key={label} label={label} />
          ))}
        </div>
      )}
      <p className="leading-snug break-words">{card.title}</p>
      {hasMeta && (
        <div className="text-muted-foreground mt-2 flex items-center gap-2">
          <DueBadge due={card.due_date} today={today} />
          {card.description && <AlignLeftIcon className="size-3.5" aria-label="Has description" />}
        </div>
      )}
    </div>
  );
}

/** A card in a list: draggable for editors, clickable for everyone. */
export function SortableCard({ card }: { card: Card }) {
  const { canEdit, today, openCard } = useBoard();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: "card", listId: card.list_id },
    disabled: !canEdit,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      // dnd-kit marks disabled sortables aria-disabled, but viewers can still open the card
      aria-disabled={undefined}
      {...listeners}
      // Enter opens the card; Space picks it up for keyboard dragging.
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openCard(card.id);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      onClick={() => openCard(card.id)}
      aria-label={`${card.title}. ${canEdit ? "Press Enter to open, Space to move." : "Press Enter to open."}`}
      className={cn(
        "group focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-[3px]",
        canEdit ? "cursor-grab touch-manipulation active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      <CardView card={card} today={today} className="group-hover:border-primary/40" />
    </li>
  );
}
