"use client";

import { createContext, useContext } from "react";
import type { useBoardState } from "@/components/board/use-board-state";

/**
 * Everything components inside a board need (state, permissions, actions),
 * shared through React context instead of passing props 4 levels deep.
 */
export type BoardContextValue = ReturnType<typeof useBoardState> & {
  currentUserId: string;
  today: string;
  canEdit: boolean;
  isOwner: boolean;
  openCard: (cardId: string) => void;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard must be used inside <BoardView>");
  return value;
}
