"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useBoard } from "@/components/board/board-context";
import { CardView } from "@/components/card/card-item";
import { AddListForm } from "@/components/list/add-list-form";
import { ListColumn, ListOverlay } from "@/components/list/list-column";
import { moveCard } from "@/lib/actions/cards";
import { moveList } from "@/lib/actions/lists";
import {
  findCard,
  findListIdOfCard,
  moveCardBetweenLists,
  type BoardState,
} from "@/lib/board-state";
import { computeInsertPosition, rebalancePositions } from "@/lib/positions";

type Active = { type: "list" | "card"; id: string } | null;

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }),
};

/**
 * The scrollable row of lists + all drag-and-drop logic.
 *
 * How a drag works:
 *  onDragStart → remember a snapshot (for rollback) and where the item started
 *  onDragOver  → (cards only) when the card crosses into another list, move it
 *                there in local state so that list makes room for it
 *  onDragEnd   → work out the final index, compute ONE new fractional position,
 *                update local state instantly, then save with a Server Action.
 *                If saving fails, persist() restores the snapshot + shows a toast.
 */
export function BoardCanvas() {
  const { state, stateRef, commit, persist, setDragging, canEdit, today } = useBoard();
  const [active, setActive] = useState<Active>(null);
  const snapshot = useRef<BoardState | null>(null);
  const origin = useRef<{ listId: string; index: number } | null>(null);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedToNewList = useRef(false);

  const sensors = useSensors(
    // Mouse: start dragging after moving 6px, so a normal click still opens a card.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: press-and-hold 200ms, so swiping still scrolls the board on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Keyboard: Space to pick up / drop, arrows to move, Escape to cancel.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  // After a card jumps to a new list, let the layout settle for one frame.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMovedToNewList.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.cardsByList]);

  /**
   * Which droppable is the pointer over?
   *  - dragging a LIST → only other lists count (closest centre)
   *  - dragging a CARD → the card under the pointer; if the pointer is over a
   *    list's empty area, the closest card in that list (or the list itself).
   * (Based on dnd-kit's official "multiple containers" example.)
   */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      if (args.active.data.current?.type === "list") {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.data.current?.type === "list",
          ),
        });
      }

      const pointerHits = pointerWithin(args);
      const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");

      if (overId != null) {
        const container = args.droppableContainers.find((c) => c.id === overId);
        if (container?.data.current?.type === "list") {
          const listCards = stateRef.current.cardsByList[String(overId)] ?? [];
          if (listCards.length > 0) {
            const cardIds = new Set(listCards.map((c) => c.id));
            overId =
              closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter((c) =>
                  cardIds.has(String(c.id)),
                ),
              })[0]?.id ?? overId;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      if (recentlyMovedToNewList.current) lastOverId.current = args.active.id;
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [stateRef],
  );

  function handleDragStart({ active }: DragStartEvent) {
    const id = String(active.id);
    const type = active.data.current?.type === "list" ? "list" : "card";
    snapshot.current = stateRef.current;
    setDragging(true);
    setActive({ type, id });

    if (type === "card") {
      const listId = findListIdOfCard(stateRef.current.cardsByList, id)!;
      const index = stateRef.current.cardsByList[listId].findIndex((c) => c.id === id);
      origin.current = { listId, index };
    }
  }

  /** Card crossed into another list → move it there right away (visual only). */
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.data.current?.type !== "card") return;
    const current = stateRef.current;
    const activeId = String(active.id);
    const overId = String(over.id);

    const fromList = findListIdOfCard(current.cardsByList, activeId);
    const toList =
      over.data.current?.type === "list" ? overId : findListIdOfCard(current.cardsByList, overId);
    if (!fromList || !toList || fromList === toList) return;

    const toCards = current.cardsByList[toList] ?? [];
    let index = toCards.length; // dropped on the list itself → end
    if (over.data.current?.type === "card") {
      const overIndex = toCards.findIndex((c) => c.id === overId);
      const translated = active.rect.current.translated;
      const isBelow = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : toCards.length;
    }

    recentlyMovedToNewList.current = true;
    commit({
      ...current,
      cardsByList: moveCardBetweenLists(current.cardsByList, activeId, toList, index),
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const before = snapshot.current;
    setActive(null);
    setDragging(false);
    snapshot.current = null;
    if (!before) return;

    // Dropped outside any list → put everything back.
    if (!over) {
      commit(before);
      return;
    }

    if (active.data.current?.type === "list")
      finishListDrag(String(active.id), String(over.id), before);
    else finishCardDrag(String(active.id), String(over.id), over.data.current?.type, before);
  }

  function finishListDrag(listId: string, overId: string, before: BoardState) {
    const lists = stateRef.current.lists;
    const oldIndex = lists.findIndex((l) => l.id === listId);
    const newIndex = lists.findIndex((l) => l.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(lists, oldIndex, newIndex);
    const siblings = reordered.filter((l) => l.id !== listId);
    const { position, rebalance } = computeInsertPosition(siblings, newIndex);

    let next = reordered.map((l) => (l.id === listId ? { ...l, position } : l));
    if (rebalance) next = rebalancePositions(next);
    commit({ ...stateRef.current, lists: next });

    void persist(() => moveList({ listId, boardId: before.board.id, position, rebalance }), before);
  }

  function finishCardDrag(cardId: string, overId: string, overType: unknown, before: BoardState) {
    const current = stateRef.current;
    const listId = findListIdOfCard(current.cardsByList, cardId);
    if (!listId) return;

    // Final order inside the list the card is now in.
    let items = current.cardsByList[listId];
    if (overType === "card" && overId !== cardId) {
      const overList = findListIdOfCard(current.cardsByList, overId);
      if (overList === listId) {
        items = arrayMove(
          items,
          items.findIndex((c) => c.id === cardId),
          items.findIndex((c) => c.id === overId),
        );
      }
    }
    const finalIndex = items.findIndex((c) => c.id === cardId);

    // Nothing actually changed → no request.
    if (origin.current?.listId === listId && origin.current.index === finalIndex) {
      commit(before);
      return;
    }

    const siblings = items.filter((c) => c.id !== cardId);
    const { position, rebalance } = computeInsertPosition(siblings, finalIndex);

    let nextItems = items.map((c) => (c.id === cardId ? { ...c, position, list_id: listId } : c));
    if (rebalance) nextItems = rebalancePositions(nextItems);
    commit({ ...current, cardsByList: { ...current.cardsByList, [listId]: nextItems } });

    void persist(() => moveCard({ cardId, toListId: listId, position, rebalance }), before);
  }

  function handleDragCancel() {
    if (snapshot.current) commit(snapshot.current);
    snapshot.current = null;
    setActive(null);
    setDragging(false);
  }

  // Screen-reader messages (dnd-kit reads these out loud).
  const nameOf = (id: UniqueIdentifier) => {
    const s = stateRef.current;
    return (
      s.lists.find((l) => l.id === id)?.title ??
      findCard(s.cardsByList, String(id))?.title ??
      "item"
    );
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} is over ${nameOf(over.id)}.`
        : `${nameOf(active.id)} is no longer over a drop area.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${nameOf(active.id)}.`
        : `${nameOf(active.id)} was dropped outside and put back.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const activeCard = active?.type === "card" ? findCard(state.cardsByList, active.id) : undefined;
  const activeList =
    active?.type === "list" ? state.lists.find((l) => l.id === active.id) : undefined;

  return (
    <DndContext
      // stable id avoids server/client hydration mismatches in dnd-kit's aria ids
      id={`board-dnd-${state.board.id}`}
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To pick up an item, press Space. Use the arrow keys to move it, Space again to drop, or Escape to cancel.",
        },
      }}
    >
      <div className="flex min-h-0 flex-1 snap-x snap-proximity scrollbar-thin items-start gap-3 overflow-x-auto px-4 pt-4 pb-6 sm:snap-none sm:px-6">
        <SortableContext
          items={state.lists.map((l) => l.id)}
          strategy={horizontalListSortingStrategy}
        >
          {state.lists.map((list) => (
            <ListColumn key={list.id} list={list} cards={state.cardsByList[list.id] ?? []} />
          ))}
        </SortableContext>

        {state.lists.length === 0 && !canEdit && (
          <div className="text-muted-foreground w-full rounded-xl border border-dashed p-10 text-center text-sm">
            This board has no lists yet.
          </div>
        )}
        {canEdit && <AddListForm />}
      </div>

      {/* The floating copy that follows the pointer while dragging. */}
      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard && (
          <CardView card={activeCard} today={today} overlay className="w-[min(85vw,17rem)]" />
        )}
        {activeList && (
          <ListOverlay
            list={activeList}
            cards={state.cardsByList[activeList.id] ?? []}
            today={today}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
