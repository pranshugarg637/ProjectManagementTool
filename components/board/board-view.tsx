"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BoardCanvas } from "@/components/board/board-canvas";
import { BoardContext, type BoardContextValue } from "@/components/board/board-context";
import { BoardHeader } from "@/components/board/board-header";
import { useBoardRealtime } from "@/components/board/use-board-realtime";
import { useBoardState } from "@/components/board/use-board-state";
import { CardDialog } from "@/components/card/card-dialog";
import { todayISO } from "@/lib/due-date";
import { can, canEditContent } from "@/lib/permissions";
import type { BoardData } from "@/types/app";

const noopSubscribe = () => () => {};

/**
 * The whole board page on the client:
 *   state (useBoardState) + live updates (useBoardRealtime) + UI.
 * Everything below reads from BoardContext.
 */
export function BoardView({
  initialData,
  currentUserId,
  serverToday,
}: {
  initialData: BoardData;
  currentUserId: string;
  serverToday: string;
}) {
  const router = useRouter();
  const store = useBoardState(initialData, currentUserId);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // "Today" in the user's own timezone (the server's date is used for the first
  // render so server and client HTML match).
  const today = useSyncExternalStore(noopSubscribe, todayISO, () => serverToday);

  const { refresh, stateRef } = store;
  useBoardRealtime({
    boardId: initialData.board.id,
    onChange: refresh,
    onBoardDeleted: () => {
      toast.info("This board was deleted.");
      router.replace("/boards");
      router.refresh();
    },
    getKnownIds: useCallback(() => {
      const ids = new Set(stateRef.current.lists.map((l) => l.id));
      for (const cards of Object.values(stateRef.current.cardsByList)) {
        for (const c of cards) ids.add(c.id);
      }
      return ids;
    }, [stateRef]),
  });

  const role = store.state.role;
  const value: BoardContextValue = useMemo(
    () => ({
      ...store,
      currentUserId,
      today,
      canEdit: canEditContent(role),
      isOwner: can(role, "members:invite"),
      openCard: setOpenCardId,
    }),
    [store, currentUserId, today, role],
  );

  return (
    <BoardContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col">
        <BoardHeader />
        <BoardCanvas />
      </div>
      <CardDialog cardId={openCardId} onClose={() => setOpenCardId(null)} />
    </BoardContext.Provider>
  );
}
