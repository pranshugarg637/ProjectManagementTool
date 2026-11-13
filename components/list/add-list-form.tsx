"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** The "+ Add list" column at the end of the board. */
export function AddListForm() {
  const { addList } = useBoard();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:border-primary/40 hover:bg-column hover:text-foreground flex h-11 w-[85vw] max-w-72 shrink-0 snap-start items-center gap-2 rounded-xl border border-dashed px-3 text-sm transition-colors sm:w-72"
      >
        <PlusIcon className="size-4" /> Add list
      </button>
    );
  }

  return (
    <form
      className="bg-column w-[85vw] max-w-72 shrink-0 space-y-2 rounded-xl p-2 sm:w-72"
      onSubmit={(e) => {
        e.preventDefault();
        const value = title.trim();
        if (!value) return;
        void addList(value.slice(0, 100));
        setTitle("");
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="List title…"
        maxLength={100}
        aria-label="New list title"
      />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Add list
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
        >
          <XIcon />
        </Button>
      </div>
    </form>
  );
}
