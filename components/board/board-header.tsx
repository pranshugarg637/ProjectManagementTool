"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeftIcon, EyeIcon, LogOutIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { ActivityDialog } from "@/components/board/activity-dialog";
import { AiSummaryDialog } from "@/components/board/ai-summary-dialog";
import { useBoard } from "@/components/board/board-context";
import { MembersStack } from "@/components/board/members-stack";
import { RoleBadge } from "@/components/board/role-badge";
import { ShareDialog } from "@/components/board/share-dialog";
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
import { leaveBoard } from "@/lib/actions/members";
import { wouldRemoveLastOwner } from "@/lib/permissions";

export function BoardHeader() {
  const { state, isOwner, canEdit, renameBoard, removeBoard, currentUserId } = useBoard();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(state.board.title);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);

  function finishRename() {
    setEditing(false);
    const value = title.trim();
    if (value && value !== state.board.title) void renameBoard(value.slice(0, 100));
    else setTitle(state.board.title);
  }

  async function leave() {
    const result = await leaveBoard({ boardId: state.board.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("You left the board");
    router.replace("/boards");
    router.refresh();
  }

  const isLastOwner = wouldRemoveLastOwner(state.members, currentUserId, null);

  return (
    <div className="bg-background/60 border-b px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to boards">
          <Link href="/boards">
            <ChevronLeftIcon />
          </Link>
        </Button>

        {editing ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishRename();
              if (e.key === "Escape") {
                setTitle(state.board.title);
                setEditing(false);
              }
            }}
            maxLength={100}
            className="h-8 w-64 text-lg font-semibold"
            aria-label="Board title"
          />
        ) : isOwner ? (
          <button
            type="button"
            onClick={() => {
              setTitle(state.board.title);
              setEditing(true);
            }}
            className="hover:bg-accent max-w-[60vw] truncate rounded-md px-1.5 py-0.5 text-lg font-semibold tracking-tight"
            title="Click to rename"
          >
            {state.board.title}
          </button>
        ) : (
          <h1 className="max-w-[60vw] truncate px-1.5 text-lg font-semibold tracking-tight">
            {state.board.title}
          </h1>
        )}

        <RoleBadge role={state.role} />
        {!canEdit && (
          <span className="text-muted-foreground inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs">
            <EyeIcon className="size-3" /> Read-only
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <MembersStack members={state.members} />
          <ActivityDialog />
          <AiSummaryDialog />
          {isOwner && <ShareDialog />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Board actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isLastOwner && (
                <DropdownMenuItem onSelect={() => setConfirm("leave")}>
                  <LogOutIcon /> Leave board
                </DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                  <Trash2Icon /> Delete board
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {state.board.description && (
        <p className="text-muted-foreground mt-1 line-clamp-1 pl-10 text-sm">
          {state.board.description}
        </p>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "Delete this board?" : "Leave this board?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `"${state.board.title}" and all of its lists and cards will be permanently deleted for everyone.`
                : "You'll lose access until an owner invites you again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void (confirm === "delete" ? removeBoard() : leave())}
            >
              {confirm === "delete" ? "Delete board" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
