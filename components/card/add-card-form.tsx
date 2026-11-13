"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Inline "Add a card" input at the bottom of a list. */
export function AddCardForm({ listId }: { listId: string }) {
  const { addCard } = useBoard();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  function submit() {
    const value = title.trim();
    if (!value) return;
    void addCard(listId, value.slice(0, 200));
    setTitle(""); // keep the form open so you can add several cards quickly
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <PlusIcon /> Add a card
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Card title…"
        maxLength={200}
        className="bg-card min-h-14 resize-none"
        aria-label="New card title"
      />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Add card
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
