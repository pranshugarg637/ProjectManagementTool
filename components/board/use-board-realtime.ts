"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Options = {
  boardId: string;
  /** Called (debounced) whenever something on this board changed. */
  onChange: () => void;
  /** Called when the board itself was deleted by someone. */
  onBoardDeleted: () => void;
  /** Ids of lists/cards currently on screen (to recognise DELETE events). */
  getKnownIds: () => Set<string>;
};

/**
 * Supabase Realtime subscription for one board.
 *
 * Postgres changes are delivered over a websocket and respect Row Level Security,
 * so a user only ever receives changes for boards they belong to.
 *
 * Note: Supabase can't filter DELETE events by column, and for RLS tables a
 * DELETE event only contains the primary key. So we listen to all DELETEs and
 * check whether the deleted id is something we're showing.
 */
export function useBoardRealtime({ boardId, onChange, onBoardDeleted, getKnownIds }: Options) {
  // Keep the latest callbacks without re-subscribing on every render.
  const callbacks = useRef({ onChange, onBoardDeleted, getKnownIds });
  useEffect(() => {
    callbacks.current = { onChange, onBoardDeleted, getKnownIds };
  });

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Many events arrive together (e.g. a rebalance) → refresh once.
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callbacks.current.onChange(), 200);
    };
    const isOnScreen = (id: unknown) =>
      typeof id === "string" && callbacks.current.getKnownIds().has(id);
    const byBoard = `board_id=eq.${boardId}`;

    const channel = supabase
      .channel(`board:${boardId}`)
      // inserts + updates, filtered on the server to this board
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lists", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lists", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cards", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cards", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_members", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "board_members", filter: byBoard },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` },
        scheduleRefresh,
      )
      // deletes (unfiltered, see note above)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "lists" }, (payload) => {
        if (isOnScreen(payload.old.id)) scheduleRefresh();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cards" }, (payload) => {
        if (isOnScreen(payload.old.id)) scheduleRefresh();
      })
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "board_members" },
        (payload) => {
          if (payload.old.board_id === boardId) scheduleRefresh();
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "boards" }, (payload) => {
        if (payload.old.id === boardId) callbacks.current.onBoardDeleted();
      });

    // Make sure the websocket uses the signed-in user's token (needed for RLS).
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (!cancelled) channel.subscribe();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [boardId]);
}
