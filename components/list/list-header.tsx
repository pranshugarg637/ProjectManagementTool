"use client";

import { useState } from "react";
import { GripVerticalIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { List } from "@/types/app";

type HandleProps = React.HTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> };

export function ListHeader({
  list,
  cardCount,
  handleProps,
}: {
  list: List;
  cardCount: number;
  /** dnd-kit listeners/attributes for the drag handle (editors only) */
  handleProps?: HandleProps;
}) {
  const { canEdit, renameList, removeList } = useBoard();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function finishRename() {
    setEditing(false);
    const value = title.trim();
    if (value && value !== list.title) void renameList(list.id, value.slice(0, 100));
    else setTitle(list.title);
  }

  return (
    <div className="flex items-center gap-1 px-1 pb-2">
      {canEdit && handleProps && (
        <button
          type="button"
          {...handleProps}
          className="text-muted-foreground/60 hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 -ml-1 cursor-grab touch-none rounded p-1 outline-none focus-visible:ring-[3px] active:cursor-grabbing"
          aria-label={`Move list ${list.title}. Press Space to pick up.`}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      )}

      {editing ? (
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={finishRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") finishRename();
            if (e.key === "Escape") {
              setTitle(list.title);
              setEditing(false);
            }
          }}
          maxLength={100}
          className="h-7 px-2 text-sm font-semibold"
          aria-label="List title"
        />
      ) : (
        <h2
          className="min-w-0 flex-1 truncate px-1 text-sm font-semibold"
          onDoubleClick={() => canEdit && setEditing(true)}
          title={list.title}
        >
          {list.title}
        </h2>
      )}

      <span className="bg-background/70 text-muted-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
        {cardCount}
      </span>

      {canEdit && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`List actions for ${list.title}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setTitle(list.title);
                  setEditing(true);
                }}
              >
                <PencilIcon /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2Icon /> Delete list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{list.title}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This list and its {cardCount} card{cardCount === 1 ? "" : "s"} will be permanently
                  deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeList(list.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
