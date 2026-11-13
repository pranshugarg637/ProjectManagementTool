import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KanbanSquareIcon, PlusIcon } from "lucide-react";
import { BoardGridCard } from "@/components/boards/board-grid-card";
import { CreateBoardDialog } from "@/components/boards/create-board-dialog";
import { Button } from "@/components/ui/button";
import { fetchMyBoards } from "@/lib/board-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Boards" };

export default async function BoardsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const boards = await fetchMyBoards(supabase, data.user.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your boards</h1>
          <p className="text-muted-foreground text-sm">Boards you own or have been invited to.</p>
        </div>
        {boards.length > 0 && <CreateBoardDialog />}
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
          <div className="bg-primary/10 text-primary mb-4 grid size-12 place-items-center rounded-full">
            <KanbanSquareIcon className="size-6" />
          </div>
          <h2 className="text-lg font-semibold">No boards yet</h2>
          <p className="text-muted-foreground mt-1 mb-5 max-w-sm text-sm">
            Create your first board, or ask a teammate to invite you to theirs.
          </p>
          <CreateBoardDialog
            trigger={
              <Button>
                <PlusIcon /> Create your first board
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardGridCard key={board.id} board={board} />
          ))}
        </div>
      )}
    </div>
  );
}
