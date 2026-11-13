"use client";

import { useState } from "react";
import { HistoryIcon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { ActivityEntry } from "@/types/app";

type Details = Record<string, string | undefined>;

/** Human sentence for an activity_log row (rows are written by DB triggers). */
function describe(entry: ActivityEntry, listName: (id?: string) => string): string {
  const d = (entry.details ?? {}) as Details;
  switch (entry.action) {
    case "card.created":
      return `added card "${d.title}" to ${listName(d.list_id)}`;
    case "card.moved":
      return `moved "${d.title}" from ${listName(d.from_list_id)} to ${listName(d.to_list_id)}`;
    case "card.updated":
      return `edited card "${d.title}"`;
    case "card.deleted":
      return `deleted card "${d.title}"`;
    case "list.created":
      return `added list "${d.title}"`;
    case "list.renamed":
      return `renamed list "${d.from}" to "${d.to}"`;
    case "list.deleted":
      return `deleted list "${d.title}"`;
    case "member.added":
      return `added ${d.email} as ${d.role}`;
    case "member.role_changed":
      return `changed ${d.email} from ${d.from} to ${d.to}`;
    case "member.removed":
      return `removed ${d.email}`;
    case "board.renamed":
      return `renamed the board to "${d.to}"`;
    default:
      return entry.action;
  }
}

function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Recent activity (audit trail) for the board. */
export function ActivityDialog() {
  const { state } = useBoard();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setEntries(null);
    setError(null);
    const { data, error } = await createClient()
      .from("activity_log")
      .select("*")
      .eq("board_id", state.board.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    else setEntries(data);
  }

  const who = (userId: string | null) => {
    const m = state.members.find((x) => x.user_id === userId);
    return m ? m.full_name || m.email : userId ? "A former member" : "System";
  };
  const listName = (id?: string) => state.lists.find((l) => l.id === id)?.title ?? "a deleted list";

  return (
    <Dialog onOpenChange={(open) => open && void load()}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Activity">
          <HistoryIcon /> <span className="hidden md:inline">Activity</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activity</DialogTitle>
          <DialogDescription>The last 50 changes on this board.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] scrollbar-thin overflow-y-auto">
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : entries === null ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span
                    className="bg-primary/60 mt-1.5 size-1.5 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1">
                    <span className="font-medium">{who(entry.user_id)}</span>{" "}
                    <span className="text-muted-foreground">{describe(entry, listName)}</span>
                  </p>
                  <time
                    className="text-muted-foreground shrink-0 text-xs"
                    dateTime={entry.created_at}
                  >
                    {timeAgo(entry.created_at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
