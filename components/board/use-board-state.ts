"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteBoard, updateBoard } from "@/lib/actions/boards";
import { createCard, deleteCard, updateCard } from "@/lib/actions/cards";
import { createList, deleteList, renameList } from "@/lib/actions/lists";
import { fetchBoardData } from "@/lib/board-data";
import { toBoardState, type BoardState } from "@/lib/board-state";
import { normalizeLabels } from "@/lib/labels";
import { appendPosition } from "@/lib/positions";
import { createClient } from "@/lib/supabase/client";
import { newId } from "@/lib/utils";
import type { ActionResult, BoardData, Card } from "@/types/app";

export type CardChanges = Partial<Pick<Card, "title" | "description" | "due_date" | "labels">>;

/**
 * The board's client-side "store".
 *
 * Optimistic updates, in 3 steps, for every mutation:
 *   1. take a snapshot of the current state
 *   2. apply the change locally right away (UI feels instant)
 *   3. call the Server Action; if it fails → restore the snapshot + toast
 *
 * Realtime events call refresh(), which re-reads the board from Supabase. While
 * a write is in flight or a drag is happening, refreshes are queued so the UI
 * never "jumps back" mid-action.
 */
export function useBoardState(initial: BoardData, currentUserId: string) {
  const router = useRouter();
  const [state, setState] = useState<BoardState>(() => toBoardState(initial));

  // Mirror of `state` that event handlers can read synchronously.
  const stateRef = useRef<BoardState>(state);
  const pendingWrites = useRef(0);
  const refreshQueued = useRef(false);
  const dragging = useRef(false);

  const boardId = initial.board.id;

  /** Replace the whole state (always use this instead of setState). */
  const commit = useCallback((next: BoardState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Re-read the board from the database (after realtime events / errors). */
  const refresh = useCallback(async () => {
    if (pendingWrites.current > 0 || dragging.current) {
      refreshQueued.current = true;
      return;
    }
    refreshQueued.current = false;

    let data: BoardData | null;
    try {
      data = await fetchBoardData(createClient(), boardId, currentUserId);
    } catch {
      return; // offline / transient error: keep what we have
    }
    if (data === null) {
      toast.error("You no longer have access to this board.");
      router.replace("/boards");
      router.refresh();
      return;
    }
    // A write may have started while we were fetching; try again afterwards.
    if (pendingWrites.current > 0 || dragging.current) {
      refreshQueued.current = true;
      return;
    }
    commit(toBoardState(data));
  }, [boardId, currentUserId, commit, router]);

  const setDragging = useCallback(
    (value: boolean) => {
      dragging.current = value;
      if (!value && refreshQueued.current && pendingWrites.current === 0) void refresh();
    },
    [refresh],
  );

  /** Run a Server Action; on failure roll back to `snapshot`. Returns true on success. */
  const persist = useCallback(
    async (call: () => Promise<ActionResult<unknown>>, snapshot: BoardState): Promise<boolean> => {
      pendingWrites.current += 1;
      let result: ActionResult<unknown>;
      try {
        result = await call();
      } catch {
        result = { ok: false, error: "Network error — your change was not saved." };
      }
      pendingWrites.current -= 1;

      if (!result.ok) {
        commit(snapshot);
        toast.error(result.error);
        refreshQueued.current = true; // re-sync with the server to be safe
      }
      if (pendingWrites.current === 0 && refreshQueued.current && !dragging.current) {
        void refresh();
      }
      return result.ok;
    },
    [commit, refresh],
  );

  /** Apply a local change and return the previous state (the rollback snapshot). */
  const optimistic = useCallback(
    (update: (prev: BoardState) => BoardState): BoardState => {
      const snapshot = stateRef.current;
      commit(update(snapshot));
      return snapshot;
    },
    [commit],
  );

  // ---------------------------------------------------------------- board
  const renameBoard = useCallback(
    (title: string) => {
      const snapshot = optimistic((s) => ({ ...s, board: { ...s.board, title } }));
      return persist(() => updateBoard({ boardId, title }), snapshot);
    },
    [boardId, optimistic, persist],
  );

  const removeBoard = useCallback(async () => {
    const result = await deleteBoard({ boardId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Board deleted");
    router.replace("/boards");
    router.refresh();
  }, [boardId, router]);

  // ---------------------------------------------------------------- lists
  const addList = useCallback(
    (title: string) => {
      const list = {
        id: newId(),
        board_id: boardId,
        title,
        position: appendPosition(stateRef.current.lists),
        created_at: new Date().toISOString(),
      };
      const snapshot = optimistic((s) => ({
        ...s,
        lists: [...s.lists, list],
        cardsByList: { ...s.cardsByList, [list.id]: [] },
      }));
      return persist(
        () => createList({ id: list.id, boardId, title, position: list.position }),
        snapshot,
      );
    },
    [boardId, optimistic, persist],
  );

  const renameListById = useCallback(
    (listId: string, title: string) => {
      const snapshot = optimistic((s) => ({
        ...s,
        lists: s.lists.map((l) => (l.id === listId ? { ...l, title } : l)),
      }));
      return persist(() => renameList({ listId, title }), snapshot);
    },
    [optimistic, persist],
  );

  const removeList = useCallback(
    (listId: string) => {
      const snapshot = optimistic((s) => {
        const cardsByList = { ...s.cardsByList };
        delete cardsByList[listId];
        return { ...s, lists: s.lists.filter((l) => l.id !== listId), cardsByList };
      });
      return persist(() => deleteList({ listId }), snapshot);
    },
    [optimistic, persist],
  );

  // ---------------------------------------------------------------- cards
  const addCard = useCallback(
    (listId: string, title: string) => {
      const now = new Date().toISOString();
      const card: Card = {
        id: newId(),
        list_id: listId,
        board_id: boardId,
        title,
        description: null,
        position: appendPosition(stateRef.current.cardsByList[listId] ?? []),
        due_date: null,
        labels: [],
        created_by: currentUserId,
        created_at: now,
        updated_at: now,
      };
      const snapshot = optimistic((s) => ({
        ...s,
        cardsByList: { ...s.cardsByList, [listId]: [...(s.cardsByList[listId] ?? []), card] },
      }));
      return persist(
        () => createCard({ id: card.id, listId, boardId, title, position: card.position }),
        snapshot,
      );
    },
    [boardId, currentUserId, optimistic, persist],
  );

  const editCard = useCallback(
    (cardId: string, changes: CardChanges) => {
      const clean: CardChanges = {
        ...changes,
        ...(changes.labels ? { labels: normalizeLabels(changes.labels) } : {}),
      };
      const snapshot = optimistic((s) => ({
        ...s,
        cardsByList: Object.fromEntries(
          Object.entries(s.cardsByList).map(([listId, cards]) => [
            listId,
            cards.map((c) => (c.id === cardId ? { ...c, ...clean } : c)),
          ]),
        ),
      }));
      return persist(
        () =>
          updateCard({
            cardId,
            title: clean.title,
            description: clean.description,
            dueDate: clean.due_date,
            labels: clean.labels,
          }),
        snapshot,
      );
    },
    [optimistic, persist],
  );

  const removeCard = useCallback(
    (cardId: string) => {
      const snapshot = optimistic((s) => ({
        ...s,
        cardsByList: Object.fromEntries(
          Object.entries(s.cardsByList).map(([listId, cards]) => [
            listId,
            cards.filter((c) => c.id !== cardId),
          ]),
        ),
      }));
      return persist(() => deleteCard({ cardId }), snapshot);
    },
    [optimistic, persist],
  );

  return {
    state,
    stateRef,
    commit,
    persist,
    refresh,
    setDragging,
    renameBoard,
    removeBoard,
    addList,
    renameList: renameListById,
    removeList,
    addCard,
    editCard,
    removeCard,
  };
}
