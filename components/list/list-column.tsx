"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBoard } from "@/components/board/board-context";
import { AddCardForm } from "@/components/card/add-card-form";
import { CardView, SortableCard } from "@/components/card/card-item";
import { ListHeader } from "@/components/list/list-header";
import { cn } from "@/lib/utils";
import type { Card, List } from "@/types/app";

const COLUMN =
  "flex max-h-full w-[85vw] max-w-72 shrink-0 snap-start flex-col rounded-xl bg-column p-2 sm:w-72";

/**
 * One list column. It is BOTH a sortable item (lists can be reordered) and a
 * drop zone for cards (useSortable makes it droppable, so cards can be dropped
 * into an empty list).
 */
export function ListColumn({ list, cards }: { list: List; cards: Card[] }) {
  const { canEdit } = useBoard();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id, data: { type: "list" }, disabled: !canEdit });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(COLUMN, isDragging && "opacity-40")}
      aria-label={`List ${list.title}`}
    >
      <ListHeader
        list={list}
        cardCount={cards.length}
        handleProps={{ ...attributes, ...listeners, ref: setActivatorNodeRef }}
      />

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul className="-mx-1 flex min-h-10 flex-1 scrollbar-thin flex-col gap-2 overflow-y-auto px-1 pb-1">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} />
          ))}
          {cards.length === 0 && (
            <li className="border-muted-foreground/20 text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs">
              {canEdit ? "Drop cards here" : "No cards"}
            </li>
          )}
        </ul>
      </SortableContext>

      {canEdit && (
        <div className="pt-2">
          <AddCardForm listId={list.id} />
        </div>
      )}
    </section>
  );
}

/** What you see under the pointer while dragging a whole list. */
export function ListOverlay({ list, cards, today }: { list: List; cards: Card[]; today: string }) {
  return (
    <section className={cn(COLUMN, "ring-primary/40 rotate-1 shadow-2xl ring-2")}>
      <div className="flex items-center gap-1 px-2 pb-2">
        <h2 className="flex-1 truncate text-sm font-semibold">{list.title}</h2>
        <span className="text-muted-foreground text-xs">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden">
        {cards.slice(0, 6).map((card) => (
          <CardView key={card.id} card={card} today={today} />
        ))}
      </div>
    </section>
  );
}
